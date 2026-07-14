#!/usr/bin/env bash
# launchd wrapper: builds the Vite SPA if needed, then serves the static dist in the foreground
# (so launchd KeepAlive can supervise it). caffeinate keeps the Mac awake while it runs.
# Port is fixed (NP_PORT, default 5002) so the ngrok tunnel + firewall stay stable.
set -euo pipefail
cd "${NP_REPO_DIR:?set NP_REPO_DIR in the plist}"
PORT="${NP_PORT:-5002}"
[ -f dist/index.html ] || npx vite build
# vite preview serves the built dist with SPA history fallback. --strictPort so a busy port fails
# loudly (KeepAlive restarts) instead of silently drifting to another port the tunnel can't reach.
exec caffeinate -is npx vite preview --host 0.0.0.0 --port "$PORT" --strictPort
