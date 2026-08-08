#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

source "$SCRIPT_DIR/dev-home.sh"

export VINCU_LISTEN="${VINCU_LISTEN:-127.0.0.1:6768}"
configure_dev_vincu_home

EXPO_PORT="${EXPO_PORT:-8081}"
DAEMON_ENDPOINT="$(resolve_dev_daemon_endpoint)"

echo "══════════════════════════════════════════════════════"
echo "  Vincu App Dev"
echo "══════════════════════════════════════════════════════"
echo "  Metro:   http://localhost:${EXPO_PORT}"
echo "  Daemon:  ${DAEMON_ENDPOINT}"
echo "  Home:    ${VINCU_HOME}"
echo "══════════════════════════════════════════════════════"

exec cross-env \
  BROWSER="${BROWSER:-none}" \
  APP_VARIANT=development \
  EXPO_PUBLIC_LOCAL_DAEMON="$DAEMON_ENDPOINT" \
  npm run start:expo --workspace=@getvincu/app -- --port "$EXPO_PORT"
