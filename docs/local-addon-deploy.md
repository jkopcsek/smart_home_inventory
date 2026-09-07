# Local add-on install (developer workflow)

This is the scp-based flow used during development, before this repo was a
proper [add-on repository](../README.md#install-as-a-home-assistant-add-on).
It registers the add-on directly under `/addons/local` on your own HA box,
bypassing the Supervisor store — useful for testing a change without waiting
on a public repository check-for-updates cycle.

The add-on is a **pre-built image**, not a source checkout. Building from
source on-device (`ha apps rebuild`, compiling Angular + Node) is heavy enough
to OOM a Raspberry Pi 4 and can take Supervisor down with it. Instead, CI
builds the image per architecture and pushes it to GHCR
(`.github/workflows/build-addon.yml`, triggered whenever `config.yaml`'s
`version` changes on `main`); the Pi only ever runs a `docker pull`. Because
of that, nothing needs to be checked out on the Pi at all — the add-on
directory under `/addons` holds a single file, `config.yaml`.

## One-time setup

Also needed again if the `/addons/local/smart_home_inventory` directory is
ever deleted, since Supervisor loses track of the add-on with it: on GitHub,
make the `smart_home_inventory-aarch64` and `smart_home_inventory-amd64`
packages public (Supervisor pulls without registry auth) — they only exist
after the first CI run completes. Then, from your own machine:

```bash
tools/deploy/install-ha.sh
```

## Shipping a new version

Bump `version` in `config.yaml`, push to `main`, wait for the "Build and
publish add-on image" workflow to finish, then run:

```bash
tools/deploy/update-ha.sh
```

It scps `config.yaml` to `/addons/local/smart_home_inventory` (SSH target
overridable with `HA_HOST`/`HA_USER`/`HA_PORT`), then runs `ha store reload`
and `ha apps update local_smart_home_inventory` so Supervisor picks up the new
version and pulls the matching image — no HA terminal, no deploy key, no git
on the Pi.

Note this is separate from the public repository: an instance that added the
GitHub URL as a repository (the normal install path) picks up new versions
through its own "Check for updates" / Update button once CI has published the
image — no scripts needed there.
