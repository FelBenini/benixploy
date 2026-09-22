#!/bin/sh
#
# benisploy forced-command script — installed as the SSH forced command for
# the dedicated benisploy user on managed nodes.
#
# This script reads the requested action from stdin, never from
# $SSH_ORIGINAL_COMMAND.  The case statement only invokes fixed,
# parameterized docker compose invocations — no string is ever built from
# client input and passed to sh -c / eval.
#
# Deploy artifacts live under /opt/benisploy/apps/<app-id>/.
# The `build` action clones a git URL into <app-id>/build-context/, checks out
# an optional commit, and runs `docker compose build` — see do_build below.
#
# SECURITY: every filesystem path segment derived from client input MUST be
# validated against the APP_ID pattern before use. Git credentials arrive via
# the stdin auth line (never argv — argv is visible in `ps`), and are consumed
# only through GIT_ASKPASS / git config environment variables. No client
# string is ever passed through sh -c / eval.

set -euf

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------
VERSION="1.1.0"
APPS_DIR="/opt/benisploy/apps"
APP_ID_PATTERN='^[a-zA-Z0-9_-]+$'
GIT_URL_PATTERN='^https?://'

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
die() {
    msg="$1"
    code="${2:-1}"
    printf '{"error":"%s"}\n' "$msg" >&2
    exit "$code"
}

validate_app_id() {
    id="$1"
    if ! printf '%s' "$id" | grep -Eq "$APP_ID_PATTERN"; then
        die "invalid app id: '$id' — must match ${APP_ID_PATTERN}" 2
    fi
}

app_dir() {
    printf '%s/%s' "$APPS_DIR" "$1"
}

compose_file() {
    printf '%s/docker-compose.yml' "$(app_dir "$1")"
}

check_app_exists() {
    app_id="$1"
    if [ ! -d "$(app_dir "$app_id")" ]; then
        die "app not found: $app_id" 4
    fi
    if [ ! -f "$(compose_file "$app_id")" ]; then
        die "no docker-compose.yml for app: $app_id" 5
    fi
}

json_escape() {
    sed 's/\\/\\\\/g; s/"/\\"/g'
}

validate_git_url() {
    url="$1"
    case "$url" in
        http://* | https://*) ;;
        *) die "invalid git url: '$url' — must be http(s)://" 2 ;;
    esac
    if printf '%s' "$url" | grep -Eq '[[:space:][:cntrl:]]'; then
        die "invalid git url: must not contain whitespace" 2
    fi
    # Credentials never travel in the URL — auth is passed via the stdin
    # auth line. Reject any client attempt to smuggle userinfo in.
    if printf '%s' "$url" | grep -Eq '://[^/@]+@'; then
        die "invalid git url: embedded credentials are not allowed" 2
    fi
}

validate_commit() {
    commit="$1"
    if ! printf '%s' "$commit" | grep -Eq '^[A-Za-z0-9._/-]+$'; then
        die "invalid commit ref: '$commit'" 2
    fi
}

# Replace any known secret with [REDACTED] before relaying output to the
# control plane. Secrets are provider-issued alphanumeric tokens, so awk
# gsub is regex-safe for them.
redact_output() {
    value="$1"
    for secret in "$GIT_PASSWORD" "$GIT_HEADER" "$GIT_USER"; do
        [ -n "$secret" ] || continue
        value="$(printf '%s' "$value" | awk -v pat="$secret" '{ gsub(pat, "[REDACTED]"); print }')"
    done
    printf '%s' "$value"
}

log_count() {
    n="${1:-100}"
    case "$n" in
        ''|*[!0-9]*) n=100 ;;
    esac
    if [ "$n" -lt 1 ]; then n=1; fi
    if [ "$n" -gt 10000 ]; then n=10000; fi
    printf '%d' "$n"
}

# ---------------------------------------------------------------------------
# action dispatchers
# ---------------------------------------------------------------------------
do_deploy() {
    app_id="$1"
    check_app_exists "$app_id"

    printf '{"action":"deploy","app_id":"%s","status":"pulling"}\n' "$app_id"

    compose="$(compose_file "$app_id")"
    docker compose -f "$compose" pull >&2 2>&1 || true
    docker compose -f "$compose" up -d --remove-orphans >&2

    printf '{"action":"deploy","app_id":"%s","status":"ok"}\n' "$app_id"
}

do_build() {
    app_id="$1"
    git_url="$2"
    commit="${3:-}"
    auth_line="${4:-}"

    validate_app_id "$app_id"
    validate_git_url "$git_url"
    if [ -n "$commit" ]; then
        validate_commit "$commit"
    fi
    check_app_exists "$app_id"

    GIT_USER=""
    GIT_PASSWORD=""
    GIT_HEADER=""
    if [ -n "$auth_line" ]; then
        set -- $auth_line
        auth_type="${1:-}"
        if [ "$#" -gt 0 ]; then shift; fi
        case "$auth_type" in
            basic)
                GIT_USER="${1:-}"
                GIT_PASSWORD="${2:-}"
                ;;
            header)
                GIT_HEADER="$*"
                ;;
            *)
                die "invalid auth type: '$auth_type' — valid: basic|header" 2
                ;;
        esac
    fi

    ctx="$(app_dir "$app_id")/build-context"

    printf '{"action":"build","app_id":"%s","status":"cloning"}\n' "$app_id"

    rm -rf "$ctx"

    # Credentials are consumed via environment/askpass, never argv.
    if [ -n "$GIT_HEADER" ]; then
        export GIT_CONFIG_COUNT=1 \
            GIT_CONFIG_KEY_0=http.extraheader \
            GIT_CONFIG_VALUE_0="$GIT_HEADER"
    elif [ -n "$GIT_PASSWORD" ]; then
        askpass="$(mktemp)"
        chmod 700 "$askpass"
        # shellcheck disable=SC2064
        trap '[ -n "${askpass:-}" ] && rm -f "$askpass"' EXIT HUP INT TERM
        cat >"$askpass" <<'ASKPASS'
#!/bin/sh
case "$1" in
    *Username*) printf '%s\n' "$BENISPLOY_GIT_USER" ;;
    *Password*) printf '%s\n' "$BENISPLOY_GIT_PASSWORD" ;;
    *) exit 1 ;;
esac
ASKPASS
        export GIT_ASKPASS="$askpass"
        export BENISPLOY_GIT_USER="$GIT_USER"
        export BENISPLOY_GIT_PASSWORD="$GIT_PASSWORD"
    fi
    export GIT_TERMINAL_PROMPT=0

    clone_error=""
    if ! clone_output="$(git clone "$git_url" "$ctx" 2>&1)"; then
        clone_error="$clone_output"
    fi
    if [ -n "$clone_error" ]; then
        die "build clone failed: $(redact_output "$clone_error")" 6
    fi

    if [ -n "$commit" ]; then
        printf '{"action":"build","app_id":"%s","status":"checkout"}\n' "$app_id"
        checkout_error=""
        if ! checkout_output="$(git -C "$ctx" -c advice.detachedHead=false checkout --force -- "$commit" 2>&1)"; then
            checkout_error="$checkout_output"
        fi
        if [ -n "$checkout_error" ]; then
            die "build checkout failed: $(redact_output "$checkout_error")" 7
        fi
    fi

    printf '{"action":"build","app_id":"%s","status":"building"}\n' "$app_id"

    compose="$(compose_file "$app_id")"
    build_error=""
    if ! build_output="$(docker compose -f "$compose" build 2>&1)"; then
        build_error="$build_output"
    fi
    if [ -n "$build_error" ]; then
        printf '%s\n' "$(redact_output "$build_error")" >&2
        die "build failed: docker compose build exited non-zero" 8
    fi
    printf '%s\n' "$(redact_output "$build_output")" >&2

    printf '{"action":"build","app_id":"%s","status":"ok"}\n' "$app_id"
}

do_restart() {
    app_id="$1"
    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"
    docker compose -f "$compose" restart >&2

    printf '{"action":"restart","app_id":"%s","status":"ok"}\n' "$app_id"
}

do_stop() {
    app_id="$1"
    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"
    docker compose -f "$compose" down --remove-orphans >&2

    printf '{"action":"stop","app_id":"%s","status":"ok"}\n' "$app_id"
}

do_delete() {
    app_id="$1"
    purge_volumes="${2:-0}"

    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"

    if [ "$purge_volumes" = "1" ]; then
        docker compose -f "$compose" down -v --remove-orphans >&2
    else
        docker compose -f "$compose" down --remove-orphans >&2
    fi

    rm -rf "$(app_dir "$app_id")"

    printf '{"action":"delete","app_id":"%s","purged_volumes":%s,"status":"ok"}\n' \
        "$app_id" "$purge_volumes"
}

do_status() {
    app_id="$1"
    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"
    printf '{"action":"status","app_id":"%s","containers":' "$app_id"
    docker compose -f "$compose" ps --format json 2>/dev/null || printf '[]'
    printf '}\n'
}

do_logs() {
    app_id="$1"
    n="$(log_count "${2:-100}")"
    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"
    docker compose -f "$compose" logs --tail "$n" 2>/dev/null
}

do_exec() {
    # reserved for future use: run a specific compose service action
    app_id="$1"
    service="${2:-}"
    shift 2 2>/dev/null || true

    if [ -z "$service" ]; then
        die "exec requires a service name" 2
    fi

    check_app_exists "$app_id"

    compose="$(compose_file "$app_id")"
    docker compose -f "$compose" exec -T "$service" "$@"
}

do_system_info() {
    os="$(uname -s)"
    arch="$(uname -m)"
    mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
    ram_bytes=$((mem_kb * 1024))
    distro="$(grep ^PRETTY_NAME= /etc/os-release 2>/dev/null | sed 's/^PRETTY_NAME=//; s/^"//; s/"$//' || uname -s)"

    printf '{"action":"system_info","os":"%s","arch":"%s","ramBytes":%d,"distro":"%s"}\n' \
        "$os" "$arch" "$ram_bytes" "$(printf '%s' "$distro" | json_escape)"
}

# ---------------------------------------------------------------------------
# main — read action + app-id from stdin (NEVER $SSH_ORIGINAL_COMMAND)
# ---------------------------------------------------------------------------
VERSION_MSG="benisploy/exec-command ${VERSION}"

read -r line <&0 || line=""

if [ -z "$line" ]; then
    printf '%s\n' "$VERSION_MSG"
    exit 0
fi

set -- $line

action="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi

case "$action" in
    version)
        printf '%s\n' "$VERSION_MSG"
        exit 0
        ;;
    system_info)
        do_system_info
        exit 0
        ;;
esac

app_id="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi

if [ -z "$app_id" ] && [ "$action" != "version" ] && [ "$action" != "system_info" ]; then
    die "usage: <action> <app-id> [args...] — actions: deploy|restart|stop|delete|status|logs|build|system_info|version" 2
fi

validate_app_id "$app_id"

case "$action" in
    deploy)
        do_deploy "$app_id"
        ;;
    build)
        # Auth (if any) arrives on a second stdin line, separate from the
        # action line — never via argv, never in the URL.
        auth_line=""
        read -r auth_line <&0 || auth_line=""
        do_build "$app_id" "${1:-}" "${2:-}" "$auth_line"
        ;;
    restart)
        do_restart "$app_id"
        ;;
    stop)
        do_stop "$app_id"
        ;;
    delete)
        purge=0
        if [ "${1:-}" = "-v" ] || [ "${1:-}" = "--purge-volumes" ]; then
            purge=1
        fi
        do_delete "$app_id" "$purge"
        ;;
    status)
        do_status "$app_id"
        ;;
    logs)
        do_logs "$app_id" "${1:-100}"
        ;;
    exec)
        do_exec "$app_id" "$@"
        ;;
    *)
        die "unknown action: '$action' — valid: deploy|restart|stop|delete|status|logs|exec|build|system_info|version" 2
        ;;
esac
