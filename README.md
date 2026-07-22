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

The add-on is a plain git clone living directly on the add-ons partition, so
updating is a `git pull` + rebuild rather than a manual file copy. Note:
`/addons` is its own mounted filesystem, separate from `/config` — a clone
under `/config` symlinked into `/addons/local` looks fine from an SSH shell
(which mounts both), but Supervisor's own container only sees `/addons`, so it
can't resolve a symlink pointing outside it and silently fails to discover the
add-on. The clone has to physically live under `/addons/local`.

One-time setup, via the Terminal & SSH add-on:

```bash
mkdir -p /config/.ssh
ssh-keygen -t ed25519 -f /config/.ssh/id_ed25519_smart_home_inventory -N "" -C "smart-home-inventory-deploy-key"
cat /config/.ssh/id_ed25519_smart_home_inventory.pub
# add the printed key as a read-only Deploy Key on the GitHub repo, then:
GIT_SSH_COMMAND="ssh -i /config/.ssh/id_ed25519_smart_home_inventory -o IdentitiesOnly=yes" \
  git clone git@github.com:jkopcsek/smart_home_inventory.git /addons/local/smart_home_inventory
# optional: a pointer under /config for convenient Samba/File Editor access
ln -s /addons/local/smart_home_inventory /config/git-repos/smart_home_inventory
ha store reload
ha apps install local_smart_home_inventory
ha apps start local_smart_home_inventory
```

After that, pull and rebuild the latest commit from your own machine with:

```bash
tools/deploy/update-ha.sh
```

It SSHes to `homeassistant.local` (override with `HA_HOST`/`HA_USER`/`HA_PORT`
env vars), runs `git pull --ff-only` against the deploy key above, then
`ha apps rebuild local_smart_home_inventory` — no HA terminal needed.

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
