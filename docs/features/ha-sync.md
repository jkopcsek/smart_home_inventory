# Home Assistant sync

## Intention

Import HA's area and device registries so the inventory starts pre-filled and
stays aligned — without ever destroying data the user typed in by hand.

## Design

- HA exposes these registries **only via its WebSocket API**
  (`config/area_registry/list`, `config/device_registry/list`). The client
  connects per sync and closes again — no persistent connection plumbing.
- Three modes, resolved from the environment
  ([app-config.ts](../../apps/backend/src/app/config/app-config.ts)):
  1. `supervisor` — `SUPERVISOR_TOKEN` present (running as add-on), via
     `ws://supervisor/core/websocket`;
  2. `direct` — `HA_URL` + `HA_TOKEN` (dev against a real instance);
  3. `mock` — built-in fixtures, so the whole app works offline.
- The merge itself is a **pure function** `mergeRegistry(local, remote)` with
  the interesting rules:
  - match by `haAreaId` / `haDeviceId`; purely local entities are untouched;
  - names **follow HA until the user renames locally** (detected by comparing
    the local name to the last-synced `haName`);
  - `manufacturer`/`model` are only filled when locally empty;
  - devices follow HA area moves until the user reassigned them manually
    (tracked via `haAreaIdAtSync`);
  - entities gone from HA are flagged `haOrphaned`, never deleted;
  - HA "service" devices are skipped.
- **Read-only guarantee**: the app only ever reads from HA (registry list
  commands). This is enforced at the transport layer — in read-only mode
  (default; `HA_READ_ONLY` env / `read_only` add-on option) the WebSocket
  client refuses any command not on its read-only allowlist, so future write
  features cannot bypass the toggle by accident.
- All writes of one sync run in a single transaction. Sync is triggered
  manually from Settings (plus one startup attempt in supervisor mode, and an
  optional `HA_SYNC_INTERVAL_MINUTES` timer).

## Code

- Merge rules + unit tests: [ha-sync.merge.ts](../../apps/backend/src/app/ha/ha-sync.merge.ts),
  [ha-sync.merge.spec.ts](../../apps/backend/src/app/ha/ha-sync.merge.spec.ts)
- WS protocol client: [ws-ha-registry.client.ts](../../apps/backend/src/app/ha/ws-ha-registry.client.ts)
- Orchestration/transaction: [ha-sync.service.ts](../../apps/backend/src/app/ha/ha-sync.service.ts)
- Fixtures: [registry.fixtures.ts](../../apps/backend/src/app/ha/fixtures/registry.fixtures.ts)
- UI: sync card on the [settings page](../../apps/frontend/src/app/features/settings/settings-page.component.ts)
