#!/bin/sh
# Start the ThermoLab dev server fully detached from the calling shell.
# Usage: scripts/start-dev.sh [port]
set -e

PORT="${1:-5173}"
LOG_DIR="${LOG_DIR:-/tmp/opencode/logs}"
LOG_FILE="$LOG_DIR/thermolab-dev.log"

mkdir -p "$LOG_DIR"
cd "$(dirname "$0")/.."

# Kill anything already holding the port.
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
fi

setsid nohup npx vite --host 127.0.0.1 --port "$PORT" --strictPort \
  > "$LOG_FILE" 2>&1 < /dev/null &

# Poll until the server answers.
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "ThermoLab dev server ready on http://127.0.0.1:${PORT}/ (log: $LOG_FILE)"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo "ThermoLab dev server failed to start; see $LOG_FILE" >&2
tail -20 "$LOG_FILE" >&2 || true
exit 1
