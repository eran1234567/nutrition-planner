#!/usr/bin/env bash
# launchd wrapper: waits for the local server, then runs the ngrok tunnel on this machine's reserved
# nutrition domain in the foreground (KeepAlive supervises it). Uses the authtoken in ~/.../ngrok.yml.
# NP_TUNNEL_URL is the reserved domain for THIS machine (e.g. https://nutrition-planner.ngrok.app on the
# MacBook, https://nutrition-planner-imac.ngrok.app on the iMac). NP_PORT must match run-server.sh.
set -euo pipefail
PORT="${NP_PORT:-5002}"
URL="${NP_TUNNEL_URL:?set NP_TUNNEL_URL (the reserved ngrok domain) in the plist}"
for _ in $(seq 1 60); do curl -fs "http://localhost:${PORT}/" >/dev/null 2>&1 && break; sleep 2; done
exec ngrok http --url="$URL" "$PORT" --log=stdout
