# Smart Home Inventory App — Bootstrap Notes

Reference notes for building a Home Assistant **App** (formerly "add-on") that
documents rooms, devices, capabilities, connections, and electrical setup —
built as an Nx monorepo with a NestJS backend and an Angular frontend.

These notes capture the architecture decisions and constraints worked out
before writing any code. Treat this as the starting brief for the repo, not
finished documentation.

---

## 1. Architecture decision (why this shape)

- **Packaging: Home Assistant "App"** (Supervisor add-on), not a custom panel
  and not a Lovelace card.
  - A custom panel needs a companion Python/HACS integration to register
    itself (`async_register_panel`) and serve static assets — that
    registration step can only be done by code running inside Core's own
    process, which an isolated Docker container can't do directly. More
    moving parts, two separate installs (App + HACS integration), broader
    permissions if serving from `/config/www`.
  - A Supervisor App reached via **Ingress** is simpler to ship as one
    installable unit, gets its own persistent storage that's automatically
    included in HA backups, and — since Ingress is proxied through Core's
    own origin rather than a different host/port — can still get reasonably
    close to HA's native look and feel (see §5).
- **Frontend framework: Angular**, despite Lit being the framework HA's own
  frontend uses internally. There's no meaningful ecosystem advantage either
  way (no official component library or SDK exists for third-party App
  frontends in *any* framework) — the deciding factor was developer
  familiarity, weighed against Angular's one known extra wrinkle: its router
  assumes a fixed, buildable-in base href, which doesn't play nicely with
  Ingress's dynamic path out of the box (see §4).
- **Later, for dashboard visibility:** don't build a custom panel or card for
  simple summaries. Push a handful of values back to Home Assistant as real
  entities (sensors/binary_sensors) via the Core API the backend already has
  access to (§3). Users then use stock HA cards on their own dashboards —
  zero custom frontend code, and it survives HA frontend updates for free.
  Only build an actual custom Lovelace card later if a specific rich widget
  (e.g. a mini floor-plan tile) is worth the ongoing maintenance cost.

---

## 2. Suggested Nx monorepo layout

```
apps/
  backend/     # NestJS — REST API, DB access, HA Core API client, file storage
  frontend/    # Angular — the Ingress-served UI
libs/
  shared/      # DTOs / types shared between backend and frontend
```

For production, the **NestJS backend serves the built Angular output** as
static files from a single Node process on a single port. Ingress only
proxies one port per App, so backend + frontend need to be reachable through
that one entry point (e.g. NestJS serves `/` → Angular `dist/`, and exposes
its own API under a prefix like `/api/...`).

---

## 3. Home Assistant App packaging essentials

Official example repos worth starting from / cross-referencing:

- `home-assistant/apps-example` — official minimal example.
- `hassio-addons/addon-example` — Community Add-ons org's example
  (Dockerfile, s6-overlay init structure, `config.yaml`).
- `johanzander/ha-add-on-template` — a small, unmaintained hobby example
  combining a Python/FastAPI backend with a React/Vite frontend in one App.
  Not a library to depend on (no releases, single commit) — useful purely as
  a structural reference for how Dockerfile / `config.yaml` / dev & deploy
  scripts fit together; the same shape applies with NestJS + Angular.

Minimal `config.yaml` fields to start from (adapt, not exhaustive):

```yaml
name: "Smart Home Inventory"
version: "0.1.0"
slug: "smart-home-inventory"
description: "Document rooms, devices, connections, and electrical setup"
arch:
  - aarch64
  - amd64
ingress: true
ingress_port: 8099          # must match the port your Node process listens on
homeassistant_api: true     # grants Core REST/WebSocket access via Supervisor proxy
hassio_api: true            # grants Supervisor-level info access
panel_icon: mdi:home-assistant
panel_title: "Smart Home Inventory"
```

Everything the container writes under **`/data`** is automatically included
in Home Assistant's backups (full or partial) — no custom backup logic
needed. This is the key rule: SQLite/Postgres files, uploaded floor plan
images, attached manuals, all of it must live under `/data`, or it won't
persist across restarts and won't be backed up.

`map` (folder access beyond `/data`, e.g. `config:rw`) is **not needed** for
this architecture — that permission is only relevant if going the custom
panel route (writing into `/config/www`), which was ruled out in §1.

---

## 4. Ingress: the dynamic base-path problem

Ingress serves the App at a **dynamic, per-install path**, e.g.:

```
/api/hassio_ingress/<random-token>/...
```

This breaks Angular Router's default assumption of a fixed, build-time
`<base href>`. Confirmed as a real, recurring pain point in the HA developer
community specifically for Angular (not just a hypothetical concern).

Two ways to handle it, in order of recommendation:

1. **Hash-based routing** (`useHash: true` in `RouterModule.forRoot`) —
   sidesteps the problem entirely, since the app never needs to know its own
   absolute path. Simplest, most robust option; the only downside is `#` in
   the URL, which doesn't matter inside an Ingress iframe context.
2. **Template the base href at container startup** — read the Ingress path
   via the `bashio` helper library (`bashio::addon.ingress_entry`) in the
   container's startup script, and inject it into `index.html`'s
   `<base href="...">` tag (and/or a `window.BASE_URL` global) before
   serving. This is the documented, idiomatic pattern most existing Apps use
   when they can't avoid path-based routing. HA also sends an
   `X-Ingress-Path` request header per-request as an alternative source for
   the same value if templating at request time instead of startup.

Given Angular fluency was the deciding factor for framework choice, start
with **hash routing** — it removes this entire class of bugs for free.

---

## 5. Matching Home Assistant's look and feel

No official, reusable component library or design-token package exists for
third-party Apps — HA's own frontend (`home-assistant/frontend`, Lit +
TypeScript) isn't published for external reuse. What *is* usable:

- **CSS custom properties** — HA's theme system exposes documented variables
  (`--primary-color`, `--card-background-color`, `--mdc-theme-primary`,
  etc.). Since these are computed in the *parent* document and don't
  propagate into the Ingress iframe's separate document, they need to be
  copied into the app's own stylesheet manually (both light and dark
  variants) rather than inherited automatically.
- **Icons** — `@mdi/js` on npm gives the exact same Material Design Icons set
  HA uses.
- **Font** — Roboto, same as HA.
- **Dark/light detection** — because Ingress content is proxied through
  Core's own origin (same host+port as the main frontend, not a separate
  one), the app's JS can read the browser's `localStorage` directly and find
  the same `selectedTheme` key HA's own frontend writes there. This is a
  **community-discovered convention, not a documented/stable API** — read it
  defensively (try/catch), and fall back to
  `window.matchMedia('(prefers-color-scheme: dark)')` if the key is missing,
  malformed, or set to `"auto"` (in which case the raw stored value may not
  reflect the live computed state).
- **Full theme-color fidelity** (beyond just light/dark) — HA's WebSocket API
  has a documented `frontend/get_themes` command that returns resolved theme
  color definitions; callable from the backend since it already has Core API
  access via `SUPERVISOR_TOKEN`. Reflects the system default theme more
  reliably than a specific user's personal override.
- **Practical recommendation:** don't chase full custom-theme fidelity. Build
  one light and one dark palette modeled on HA's stock Material colors, and
  switch between them using the `localStorage` read + `prefers-color-scheme`
  fallback. This covers the large majority of "feels native" perception for
  much less ongoing maintenance than trying to mirror every possible
  user-customized accent color.

---

## 6. Backend ↔ Home Assistant communication

- Supervisor injects a **`SUPERVISOR_TOKEN`** environment variable into the
  container automatically.
- Use it to call Home Assistant Core's REST/WebSocket API through
  Supervisor's internal proxy (`http://supervisor/core/api/...`) — this is
  how the backend should sync rooms/devices against HA's own area, device,
  floor, and label registries, and (later) how it would push summary data
  back as entities for dashboard use (§1).
- Requires `homeassistant_api: true` (and `hassio_api: true` for
  Supervisor-level info) in `config.yaml`.
- Full endpoint reference: Home Assistant Developer Docs → Supervisor API
  endpoints.

---

## 7. Reference links

- Presenting your App (Ingress, `config.yaml`, security rating):
  `https://developers.home-assistant.io/docs/apps/presentation/`
- Supervisor API endpoints:
  `https://developers.home-assistant.io/docs/api/supervisor/endpoints/`
- Creating custom panels (for future reference, not used here):
  `https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/`
- HA core frontend source (for design-token/CSS reference):
  `https://github.com/home-assistant/frontend`
- Official example App repos:
  `https://github.com/home-assistant/apps-example`
  `https://github.com/hassio-addons/addon-example`
- Full-stack structural reference (not a dependency):
  `https://github.com/johanzander/ha-add-on-template`