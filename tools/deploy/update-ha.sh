#!/usr/bin/env bash
# Publishes the add-on manifest and tells Supervisor to pull the matching
# pre-built image. The image itself is built by CI (see
# .github/workflows/build-addon.yml) whenever config.yaml's version changes
# on main — wait for that run to finish before running this script.
# One-time setup: see "Updating the add-on" in the top-level README.
set -euo pipefail

HA_HOST="${HA_HOST:-homeassistant.local}"
HA_USER="${HA_USER:-root}"
HA_PORT="${HA_PORT:-22}"
REPO_DIR="/addons/local/smart_home_inventory"
ADDON_SLUG="local_smart_home_inventory"

scp -P "$HA_PORT" config.yaml "${HA_USER}@${HA_HOST}:${REPO_DIR}/config.yaml"

ssh -p "$HA_PORT" "${HA_USER}@${HA_HOST}" bash -s <<EOF
set -euo pipefail
ha store reload
ha apps update "$ADDON_SLUG"
EOF
