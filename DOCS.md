# Smart Home Inventory

Two jobs in one add-on: an **inventory** of every device in your home (what
it is, where it's installed, purchase info, capabilities) and a **wiring
record** of how it's actually connected — fuses, switches, power supplies,
and the cables between them. Both live locally, next to each other, so you
stop losing this information to memory, random photos, or a spreadsheet that
falls out of date.

- **Areas & devices** — synced straight from Home Assistant's own registry
  (one click, uses the Supervisor token automatically), then enriched with
  the details HA doesn't track: purchase date, install notes, capabilities,
  physical location. Devices HA doesn't know about — junction boxes,
  passive switches, fuses — get added directly as local devices, and each
  area page shows at a glance what's synced from HA and what's local-only.
- **Connections & plans** — draw the actual wiring between devices as a
  diagram, not just electrical: model water, gas, and network runs the same
  way, alongside 230V mains, 24V DC, or a Zigbee binding. It's the thing you
  wish you had the one time a breaker trips, a pipe needs shutting off, or
  you're tracing which switch feeds which outlet.
- **Attachments** — manuals, invoices, warranty cards, floor plans, photos —
  attach them to the device or area they belong to, annotate plans/photos
  directly, and pull mermaid diagrams out of what you've documented.

All of it is stored under `DATA_DIR`, so it rides along with your normal HA
backups — no separate export/import step.

## Screenshots

Areas synced from Home Assistant, with local-only devices mixed in:

![Area with synced and local devices](https://raw.githubusercontent.com/jkopcsek/smart_home_inventory/main/docs/images/area-devices.png)

A plan showing the actual wiring between fuse, switches, and devices,
color-coded by connection type — the same view works for water, gas, or
network runs, not just electrical:

![Wiring plan diagram](https://raw.githubusercontent.com/jkopcsek/smart_home_inventory/main/docs/images/electrical-plan.png)

## Installation

1. Settings → Add-ons → Add-on Store → ⋮ (top right) → Repositories, and add
   `https://github.com/jkopcsek/smart_home_inventory`.
2. Find "Smart Home Inventory" in the store and install it.
3. Start the add-on, then open it from the sidebar panel (or "Open Web UI").

## How to use

On first start the add-on has no data. Go to Settings inside the app and use
"Sync from Home Assistant" to import your areas and devices from HA's
registry — this uses the Supervisor token automatically, no setup needed.
From there, add capabilities, wire up actual connections, and attach photos,
floor plans, manuals, or invoices.

## Configuration

```yaml
read_only: true
```

| Option      | Default | Description                                                                     |
| ----------- | ------- | -------------------------------------------------------------------------------- |
| `read_only` | `true`  | Blocks any non-read Home Assistant command from the sync client. Turn off only if you intend to let the add-on write back to HA (not currently used by any feature). |

## Known issues and limitations

- Sync only pulls from Home Assistant; it does not push changes back.
- The Ingress URL is dynamic per session — don't bookmark it directly, use
  the sidebar panel.

## Support

Found a bug or have a request? Open an issue on
[GitHub](https://github.com/jkopcsek/smart_home_inventory/issues).
