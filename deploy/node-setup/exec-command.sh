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
#
# SECURITY: every filesystem path segment derived from client input MUST be
# validated against the APP_ID pattern before use.

set -euf

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------
VERSION="1.0.0"
APPS_DIR="/opt/benisploy/apps"
APP_ID_PATTERN='^[a-zA-Z0-9_-]+$'

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
shift 2>/dev/null || true

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
shift 2>/dev/null || true

if [ -z "$app_id" ] && [ "$action" != "version" ] && [ "$action" != "system_info" ]; then
    die "usage: <action> <app-id> [args...] — actions: deploy|restart|stop|delete|status|logs|system_info|version" 2
fi

validate_app_id "$app_id"

case "$action" in
    deploy)
        do_deploy "$app_id"
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
        die "unknown action: '$action' — valid: deploy|restart|stop|delete|status|logs|exec|system_info|version" 2
        ;;
esac
