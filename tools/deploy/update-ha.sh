#!/usr/bin/env bash
# Pulls the latest commit into the HA box's clone and rebuilds the local add-on.
# One-time setup: see "Updating the add-on" in the top-level README.
set -euo pipefail

HA_HOST="${HA_HOST:-homeassistant.local}"
HA_USER="${HA_USER:-root}"
HA_PORT="${HA_PORT:-22}"
REPO_DIR="/addons/local/smart_home_inventory"
DEPLOY_KEY="/config/.ssh/id_ed25519_smart_home_inventory"
ADDON_SLUG="local_smart_home_inventory"

ssh -p "$HA_PORT" "${HA_USER}@${HA_HOST}" bash -s <<EOF
set -euo pipefail
cd "$REPO_DIR"
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes" git pull --ff-only
ha apps rebuild "$ADDON_SLUG"
EOF
