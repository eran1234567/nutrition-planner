#!/usr/bin/env bash
# nutrition-planner auto-sync (VERSION-CONTROLLED, in-repo so both machines run identical logic).
# Keeps THIS machine's clone in sync with origin/main on a launchd StartInterval (~60s). Safe:
#   - only fast-forwards/rebases when strictly behind (--autostash preserves uncommitted work)
#   - a real conflict aborts and leaves the working tree untouched
#   - a divergence (both sides moved) is logged, never auto-resolved
#
# Config (from the LaunchAgent/Daemon plist EnvironmentVariables):
#   NP_REPO_DIR       (required) absolute path to the clone
#   NP_AUTO_PUSH      0|1  push local committed-but-unpushed commits (default 1)
#   NP_REBUILD        0|1  after an incoming pull, rebuild (vite) + restart the server (default 0).
#                          Set 1 on the ALWAYS-ON host (iMac), 0 on the editing machine (MacBook).
#   NP_SERVER_LABEL   launchd label to restart on a rebuild (default com.nutrition-planner.server)
set -uo pipefail

REPO="${NP_REPO_DIR:?NP_REPO_DIR not set}"
AUTO_PUSH="${NP_AUTO_PUSH:-1}"
REBUILD="${NP_REBUILD:-0}"
LABEL="${NP_SERVER_LABEL:-com.nutrition-planner.server}"
cd "$REPO" || exit 0

ts() { date "+%Y-%m-%d %H:%M:%S"; }

if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -f .git/MERGE_HEAD ]; then
  echo "$(ts) rebase/merge in progress - skipping"; exit 0
fi

git fetch -q origin main 2>/dev/null || { echo "$(ts) fetch failed (offline?) - skipping"; exit 0; }

LOCAL=$(git rev-parse @ 2>/dev/null)            || exit 0
REMOTE=$(git rev-parse origin/main 2>/dev/null) || exit 0
BASE=$(git merge-base @ origin/main 2>/dev/null) || exit 0

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0   # already in sync - stay quiet
fi

if [ "$LOCAL" = "$BASE" ]; then
  echo "$(ts) behind origin - pulling ${LOCAL:0:7}..${REMOTE:0:7}"
  if ! git pull --rebase --autostash origin main; then
    echo "$(ts) pull hit a conflict - aborting, working tree left untouched"
    git rebase --abort 2>/dev/null || true
    exit 0
  fi
  NEW=$(git rev-parse @)
  if [ "$REBUILD" = "1" ] && [ "$NEW" != "$LOCAL" ]; then
    CHANGED=$(git diff --name-only "$LOCAL" "$NEW")
    if echo "$CHANGED" | grep -qE '^(package-lock\.json|package\.json)$'; then
      echo "$(ts) deps changed -> npm install"; npm install --no-audit --no-fund || true
    fi
    # Pure Vite SPA: any change to the app source / build config means the bundle must be rebuilt.
    if echo "$CHANGED" | grep -qE '^(src/|public/|index\.html|vite\.config|tailwind\.config|postcss\.config|components\.json|tsconfig|package-lock\.json|package\.json)'; then
      echo "$(ts) app changed -> vite build"; npx vite build || echo "$(ts) !! vite build FAILED - serving previous bundle"
      echo "$(ts) restart $LABEL"
      launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>/dev/null || sudo -n /bin/launchctl kickstart -k "system/$LABEL" 2>/dev/null || true
    fi
  fi
  echo "$(ts) up to date at $(git rev-parse --short @)"
  exit 0
fi

if [ "$REMOTE" = "$BASE" ]; then
  if [ "$AUTO_PUSH" = "1" ]; then
    echo "$(ts) ahead of origin - pushing ${REMOTE:0:7}..${LOCAL:0:7}"
    git push origin main || echo "$(ts) push failed"
  fi
  exit 0
fi

echo "$(ts) DIVERGED - local and origin both moved; resolve by hand, not auto-syncing"
exit 0
