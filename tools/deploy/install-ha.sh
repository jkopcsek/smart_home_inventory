#!/usr/bin/env bash
# One-time (or recovery) install: registers the add-on with Supervisor from
# scratch. Use tools/deploy/update-ha.sh for subsequent version bumps.
# See "Updating the add-on" in the top-level README.
set -euo pipefail

HA_HOST="${HA_HOST:-homeassistant.local}"
HA_USER="${HA_USER:-root}"
HA_PORT="${HA_PORT:-22}"
REPO_DIR="/addons/local/smart_home_inventory"
ADDON_SLUG="local_smart_home_inventory"

ssh -p "$HA_PORT" "${HA_USER}@${HA_HOST}" mkdir -p "$REPO_DIR"
scp -P "$HA_PORT" config.yaml "${HA_USER}@${HA_HOST}:${REPO_DIR}/config.yaml"

ssh -p "$HA_PORT" "${HA_USER}@${HA_HOST}" bash -s <<EOF
set -euo pipefail
ha store reload
ha apps install "$ADDON_SLUG"
ha apps start "$ADDON_SLUG"
EOF
