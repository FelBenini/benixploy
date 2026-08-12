#!/bin/sh
#
# benisploy node setup — provisions a VPS or bare-metal server to be managed
# by the benisploy control plane.
#
# Usage:
#   curl -sSL <control-plane>/api/servers/install.sh | sudo bash -s -- \
#       --exec-key  "$(cat ~/.ssh/benisploy-exec.pub)"  \
#       --sftp-key  "$(cat ~/.ssh/benisploy-sftp.pub)"  \
#       --bearer-token  "eyJ..."                         \
#       --control-plane  "https://cp.example.com"        \
#       [--node-monitor-url "https://.../node-monitor"]
#
# What it does:
#   1. Installs Docker (if not present)
#   2. Creates the benisploy system user
#   3. Creates /opt/benisploy/{apps,bin,traefik/dynamic} directories
#   4. Installs the forced-command exec-command.sh script
#   5. Configures SSH authorized_keys (two entries: exec + sftp)
#   6. Installs and starts the node-monitor systemd service
#
# The script is idempotent — safe to re-run on an already-provisioned node.

set -eu

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------
VERSION="1.0.0"
BENISPLOY_USER="benisploy"
BENISPLOY_GROUP="benisploy"
BENISPLOY_BASE="/opt/benisploy"
APPS_DIR="${BENISPLOY_BASE}/apps"
BIN_DIR="${BENISPLOY_BASE}/bin"
TRAEFIK_DIR="${BENISPLOY_BASE}/traefik/dynamic"
MONITOR_BIN="${BIN_DIR}/node-monitor"
MONITOR_SERVICE="benisploy-monitor"
MONITOR_SERVICE_FILE="/etc/systemd/system/${MONITOR_SERVICE}.service"
AUTHORIZED_KEYS_FILE=""

# ---------------------------------------------------------------------------
# defaults — overridden by CLI flags
# ---------------------------------------------------------------------------
EXEC_KEY=""
SFTP_KEY=""
BEARER_TOKEN=""
CONTROL_PLANE_URL=""
NODE_MONITOR_URL=""
MONITOR_ARCH=""

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
log()  { printf '[benisploy-setup] %s\n' "$*"; }
err()  { printf '[benisploy-setup] ERROR: %s\n' "$*" >&2; }
die()  { err "$@"; exit 1; }

# Machine-readable progress markers, parsed by the control plane to update
# the install wizard's phase ticks live. Print AFTER each step succeeds.
step_done() { printf '[benisploy-setup] STEP_DONE:%s\n' "$1"; }

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        die "This script must be run as root (sudo)."
    fi
}

detect_arch() {
    arch="$(uname -m)"
    case "$arch" in
        x86_64|amd64)  MONITOR_ARCH="amd64" ;;
        aarch64|arm64) MONITOR_ARCH="arm64" ;;
        armv7l)         MONITOR_ARCH="armv7" ;;
        *)              die "Unsupported architecture: $arch" ;;
    esac
}

# ---------------------------------------------------------------------------
# step 1 — install Docker
# ---------------------------------------------------------------------------
install_docker() {
    if command -v docker >/dev/null 2>&1; then
        log "Docker already installed ($(docker --version 2>/dev/null || echo 'unknown'))."
        return 0
    fi

    log "Installing Docker..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
    else
        die "Cannot detect OS — /etc/os-release not found."
    fi

    case "$ID" in
        debian|ubuntu|linuxmint|pop|elementary|zorin)
            apt-get update -qq
            apt-get install -y -qq ca-certificates curl gnupg lsb-release
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/${ID}/gpg \
                | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg]" \
                "https://download.docker.com/linux/${ID} $(lsb_release -cs) stable" \
                > /etc/apt/sources.list.d/docker.list
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                docker-buildx-plugin docker-compose-plugin
            ;;
        fedora|rhel|centos|rocky|almalinux|ol|amzn)
            dnf -y install dnf-plugins-core
            dnf config-manager --add-repo \
                https://download.docker.com/linux/${ID}/docker-ce.repo
            dnf -y install docker-ce docker-ce-cli containerd.io \
                docker-buildx-plugin docker-compose-plugin
            systemctl enable --now docker
            return 0
            ;;
        arch|manjaro|endeavouros)
            pacman -Sy --noconfirm docker docker-compose
            systemctl enable --now docker
            return 0
            ;;
        alpine)
            apk add --no-cache docker docker-compose
            rc-update add docker boot
            service docker start
            return 0
            ;;
        opensuse*|sles)
            zypper --non-interactive install docker docker-compose
            systemctl enable --now docker
            return 0
            ;;
        *)
            die "Unsupported distro: $ID. Install Docker manually and re-run this script."
            ;;
    esac

    # Enable docker service (Debian-based path)
    systemctl enable --now docker 2>/dev/null || true
    log "Docker installed successfully."
}

# ---------------------------------------------------------------------------
# step 2 — create user and directories
# ---------------------------------------------------------------------------
setup_user_and_dirs() {
    if ! getent group "$BENISPLOY_GROUP" >/dev/null 2>&1; then
        groupadd --system "$BENISPLOY_GROUP"
        log "Created group: $BENISPLOY_GROUP"
    fi

    if ! id "$BENISPLOY_USER" >/dev/null 2>&1; then
        useradd \
            --system \
            --gid "$BENISPLOY_GROUP" \
            --home-dir "$BENISPLOY_BASE" \
            --shell /usr/sbin/nologin \
            --create-home \
            "$BENISPLOY_USER"
        log "Created user: $BENISPLOY_USER"
    fi

    usermod -aG docker "$BENISPLOY_USER" 2>/dev/null || true

    mkdir -p "$APPS_DIR" "$BIN_DIR" "$TRAEFIK_DIR"
    chown -R "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "$APPS_DIR"
    chown -R "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "$TRAEFIK_DIR"
    chmod 755 "$APPS_DIR" "$BIN_DIR" "$TRAEFIK_DIR"
    chmod 700 "$APPS_DIR"

    AUTHORIZED_KEYS_DIR="${BENISPLOY_BASE}/.ssh"
    AUTHORIZED_KEYS_FILE="${AUTHORIZED_KEYS_DIR}/authorized_keys"
    mkdir -p "$AUTHORIZED_KEYS_DIR"
    chown -R "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "$AUTHORIZED_KEYS_DIR"
    chmod 700 "$AUTHORIZED_KEYS_DIR"

    log "Directory structure created under $BENISPLOY_BASE"
}

# ---------------------------------------------------------------------------
# step 3 — install exec-command.sh
# ---------------------------------------------------------------------------
install_forced_command() {
    SCRIPT_SRC="$(dirname "$0")/exec-command.sh"

    if [ ! -f "$SCRIPT_SRC" ]; then
        # When invoked via curl pipe, the script isn't on disk.
        # The caller must have made exec-command.sh available.
        die "exec-command.sh not found at $SCRIPT_SRC. Place it alongside install.sh or provide --exec-command-path."
    fi

    cp "$SCRIPT_SRC" "${BIN_DIR}/exec-command.sh"
    chown "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "${BIN_DIR}/exec-command.sh"
    chmod 755 "${BIN_DIR}/exec-command.sh"
    log "Installed exec-command.sh to ${BIN_DIR}/exec-command.sh"
}

# ---------------------------------------------------------------------------
# step 4 — configure SSH authorized_keys
# ---------------------------------------------------------------------------
setup_ssh() {
    if [ -z "$EXEC_KEY" ] && [ -z "$SFTP_KEY" ]; then
        err "No SSH keys provided. Use --exec-key and --sftp-key."
        err "The node won't accept control-plane connections."
        return 1
    fi

    touch "$AUTHORIZED_KEYS_FILE"

    if [ -n "$EXEC_KEY" ]; then
        EXEC_LINE="command=\"${BIN_DIR}/exec-command.sh\",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding ${EXEC_KEY}"
        if ! grep -qF "$EXEC_KEY" "$AUTHORIZED_KEYS_FILE" 2>/dev/null; then
            echo "$EXEC_LINE" >> "$AUTHORIZED_KEYS_FILE"
        fi
    fi

    if [ -n "$SFTP_KEY" ]; then
        SFTP_LINE="command=\"internal-sftp\",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding ${SFTP_KEY}"
        if ! grep -qF "$SFTP_KEY" "$AUTHORIZED_KEYS_FILE" 2>/dev/null; then
            echo "$SFTP_LINE" >> "$AUTHORIZED_KEYS_FILE"
        fi
    fi

    chown "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "$AUTHORIZED_KEYS_FILE"
    chmod 600 "$AUTHORIZED_KEYS_FILE"
    log "SSH authorized_keys configured"
}

# ---------------------------------------------------------------------------
# step 5 — install node-monitor
# ---------------------------------------------------------------------------
install_node_monitor() {
    if [ -z "$NODE_MONITOR_URL" ]; then
        NODE_MONITOR_URL="${CONTROL_PLANE_URL}/api/servers/install/node-monitor?arch=${MONITOR_ARCH}"
    fi

    log "Downloading node-monitor from $NODE_MONITOR_URL"

    tmp="$(mktemp /tmp/node-monitor.XXXXXX)"
    # shellcheck disable=SC2064
    trap "rm -f $tmp" EXIT

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$tmp" "$NODE_MONITOR_URL" || die "Failed to download node-monitor"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$tmp" "$NODE_MONITOR_URL" || die "Failed to download node-monitor"
    else
        die "Neither curl nor wget available — cannot download node-monitor"
    fi

    cp "$tmp" "$MONITOR_BIN"
    chown "${BENISPLOY_USER}:${BENISPLOY_GROUP}" "$MONITOR_BIN"
    chmod 755 "$MONITOR_BIN"
    log "Installed node-monitor to $MONITOR_BIN"
}

# ---------------------------------------------------------------------------
# step 6 — systemd service
# ---------------------------------------------------------------------------
install_systemd_service() {
    if ! command -v systemctl >/dev/null 2>&1; then
        log "systemd not available — skipping service installation."
        return 0
    fi

    # Containers / non-systemd environments: systemctl may exist while PID 1
    # isn't systemd. Detect and skip instead of failing the whole provision.
    if [ "$(cat /proc/1/comm 2>/dev/null)" != "systemd" ]; then
        log "systemd is not running as PID 1 — skipping service installation."
        return 0
    fi

    cat > "$MONITOR_SERVICE_FILE" <<SERVICEEOF
[Unit]
Description=benisploy node monitor
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${BENISPLOY_USER}
Group=${BENISPLOY_GROUP}
ExecStart=${MONITOR_BIN}
Environment="CONTROL_PLANE_URL=${CONTROL_PLANE_URL%/}/api/telemetry/ingest"
Environment="BEARER_TOKEN=${BEARER_TOKEN}"
Environment="STATS_INTERVAL=30s"
Environment="PUSH_MAX_RETRIES=3"
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${MONITOR_SERVICE}

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${APPS_DIR}
ReadWritePaths=/var/run/docker.sock
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
SERVICEEOF

    systemctl daemon-reload
    systemctl enable "$MONITOR_SERVICE"
    systemctl restart "$MONITOR_SERVICE" || systemctl start "$MONITOR_SERVICE"

    log "node-monitor systemd service installed and started"
}

# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------
usage() {
    cat <<EOF
benisploy node setup v${VERSION}

Usage: $0 [OPTIONS]

Required:
  --exec-key KEY          SSH public key for the exec (forced-command) channel
  --sftp-key KEY          SSH public key for the SFTP channel
  --bearer-token TOKEN    Bearer token for node-monitor authentication
  --control-plane URL     Control plane base URL (e.g. https://cp.example.com)

Optional:
  --node-monitor-url URL  Override download URL for the node-monitor binary
  -h, --help              Show this message
EOF
    exit 0
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --exec-key)       EXEC_KEY="$2";          shift 2 ;;
            --sftp-key)       SFTP_KEY="$2";          shift 2 ;;
            --bearer-token)   BEARER_TOKEN="$2";      shift 2 ;;
            --control-plane)  CONTROL_PLANE_URL="$2"; shift 2 ;;
            --node-monitor-url) NODE_MONITOR_URL="$2"; shift 2 ;;
            -h|--help)        usage ;;
            *)                die "Unknown option: $1. Run with --help for usage." ;;
        esac
    done

    if [ -z "$CONTROL_PLANE_URL" ]; then
        die "--control-plane is required"
    fi
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
main() {
    parse_args "$@"
    require_root
    detect_arch

    log "benisploy node setup v${VERSION} — target arch: ${MONITOR_ARCH}"
    echo ""

    install_docker
    step_done "docker"

    setup_user_and_dirs
    step_done "user"

    install_forced_command
    step_done "forced_command"

    if [ -n "$EXEC_KEY" ] || [ -n "$SFTP_KEY" ]; then
        setup_ssh
        step_done "ssh"
    fi

    if [ -n "$BEARER_TOKEN" ]; then
        install_node_monitor
        step_done "node_monitor"

        install_systemd_service
        step_done "systemd"
    else
        log "No bearer token provided — skipping node-monitor installation."
    fi

    echo ""
    log "Setup complete."
    log "  Apps directory:   ${APPS_DIR}"
    log "  Forced command:   ${BIN_DIR}/exec-command.sh"
    log "  Exec SSH key:     ${EXEC_KEY:+configured}"
    log "  SFTP SSH key:     ${SFTP_KEY:+configured}"
    if [ -n "$BEARER_TOKEN" ]; then
        log "  Monitoring:       ${MONITOR_SERVICE}.service (${CONTROL_PLANE_URL})"
    fi
}

main "$@"
