#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/../node_modules/.bin:$PATH"

source "$SCRIPT_DIR/dev-home.sh"

export VINCU_LISTEN="${VINCU_LISTEN:-127.0.0.1:6768}"
configure_dev_vincu_home

if [ -z "${VINCU_LOCAL_MODELS_DIR}" ]; then
  export VINCU_LOCAL_MODELS_DIR="$HOME/.vincu/models/local-speech"
  mkdir -p "$VINCU_LOCAL_MODELS_DIR"
fi

echo "══════════════════════════════════════════════════════"
echo "  Vincu Dev Daemon"
echo "══════════════════════════════════════════════════════"
echo "  Home:    ${VINCU_HOME}"
echo "  Models:  ${VINCU_LOCAL_MODELS_DIR}"
echo "  Listen:  ${VINCU_LISTEN}"
echo "══════════════════════════════════════════════════════"

export VINCU_CORS_ORIGINS="${VINCU_CORS_ORIGINS:-*}"
export VINCU_NODE_INSPECT="${VINCU_NODE_INSPECT:---inspect=0}"

if [ "${VINCU_SKIP_DEV_SERVER_BUILD:-0}" = "1" ]; then
  exec npm run dev:server:watch
fi

exec sh -c 'npm run build:server-deps && npm run dev:server:watch'
