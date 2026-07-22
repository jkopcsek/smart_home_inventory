# Smart Home Inventory

A Home Assistant add-on (served via Ingress) that documents your home's
electrical and smart-home setup: areas, devices, capabilities, actual
connections, annotated plans/photos, and mermaid diagrams.

- Architecture background and constraints: [BOOTSTRAP.md](BOOTSTRAP.md)
- Per-feature design notes: [docs/features/](docs/features/README.md)

## Stack

Nx monorepo — NestJS backend (`apps/backend`), Angular frontend
(`apps/frontend`), shared zod DTOs (`libs/shared`). SQLite via Prisma; all
persistent state (DB + uploaded files) lives under `DATA_DIR` (`/data` in the
add-on, `./data` in dev) so HA backups cover it automatically.

## Development

```bash
npm install
npm run prisma:migrate      # create/update ./data/inventory.db
npm run dev                 # backend on :8099, frontend dev server with /api proxy
```

Open the frontend dev server URL it prints (usually http://localhost:4200).

Without any HA configuration the backend runs in **mock** mode — "Sync from
Home Assistant" in Settings imports built-in fixture areas/devices. To sync a
real instance during development, set in `.env`:

```
HA_URL=http://homeassistant.local:8123
HA_TOKEN=<long-lived access token>
```

### Useful commands

```bash
npx nx build backend|frontend|shared     # production builds
npx nx test backend|frontend|shared      # unit tests (merge rules, schema, editor math)
npx nx run-many -t eslint:lint           # lint everything
npm run prisma:migrate                   # prisma migrate dev (schema changes)
```

### Testing the Ingress environment locally

Ingress serves the app under a dynamic path (`/api/hassio_ingress/<token>/`),
which is the main class of bugs for add-on frontends. To simulate it:

```bash
npx nx build backend && npx nx build frontend
DATA_DIR=./data STATIC_DIR=dist/apps/frontend/browser node dist/apps/backend/main.js &
node tools/ingress-proxy/proxy.mjs
# open http://localhost:8100  (renders the app in an iframe under a fake ingress prefix)
```

The app survives this because it uses hash routing, `<base href="./">`, and
strictly relative API/asset URLs (guarded by an HTTP interceptor).

## Install as a Home Assistant add-on

The repo root is the add-on directory (`config.yaml` + `Dockerfile`). For a
local add-on: copy the repo to `/addons/smart_home_inventory` on your HA box,
then Settings → Add-ons → Add-on store → ⋮ → Check for updates, and install
"Smart Home Inventory". On startup the container runs `prisma migrate deploy`
and serves the UI through Ingress on port 8099.

`homeassistant_api: true` gives the backend `SUPERVISOR_TOKEN` automatically —
sync then talks to `ws://supervisor/core/websocket`.

### Updating the add-on

The add-on is a **pre-built image**, not a source checkout. Building from
source on-device (`ha apps rebuild`, compiling Angular + Node) is heavy enough
to OOM a Raspberry Pi 4 and can take Supervisor down with it. Instead, CI
builds the image per architecture and pushes it to GHCR
(`.github/workflows/build-addon.yml`, triggered whenever `config.yaml`'s
`version` changes on `main`); the Pi only ever runs a `docker pull`. Because
of that, nothing needs to be checked out on the Pi at all — the add-on
directory under `/addons` holds a single file, `config.yaml`.

One-time setup (also needed again if the `/addons/local/smart_home_inventory`
directory is ever deleted, since Supervisor loses track of the add-on with
it): on GitHub, make the `smart_home_inventory-aarch64` and
`smart_home_inventory-amd64` packages public (Supervisor pulls without
registry auth) — they only exist after the first CI run completes. Then, from
your own machine:

```bash
tools/deploy/install-ha.sh
```

To ship a new version: bump `version` in `config.yaml`, push to `main`, wait
for the "Build and publish add-on image" workflow to finish, then run:

```bash
tools/deploy/update-ha.sh
```

It scps `config.yaml` to `/addons/local/smart_home_inventory` (SSH target
overridable with `HA_HOST`/`HA_USER`/`HA_PORT`), then runs `ha store reload`
and `ha apps update local_smart_home_inventory` so Supervisor picks up the new
version and pulls the matching image — no HA terminal, no deploy key, no git
on the Pi.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8099` | must match `ingress_port` |
| `DATA_DIR` | `/data` | SQLite DB + uploads root |
| `STATIC_DIR` | unset | serve built Angular app from this dir (prod) |
| `HA_URL` / `HA_TOKEN` | unset | dev: sync against a real HA instance |
| `HA_MOCK` | `false` | force fixture registry |
| `HA_READ_ONLY` | `true` | hard guard: block any non-read HA command at the client (also add-on option `read_only`) |
| `HA_SYNC_INTERVAL_MINUTES` | `0` (off) | periodic background sync |
| `UPLOAD_MAX_BYTES` | 50 MB | upload size limit |
