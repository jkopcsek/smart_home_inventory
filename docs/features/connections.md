# Connections

## Intention

Document *actual* wiring and network topology, not capabilities: which breaker
feeds which outlet, which devices are Zigbee-bound directly vs. routed through
the coordinator, what hangs on which switch port.

## Design

- A connection is a **directed device→device edge**: `from` is the
  upstream/provider end (breaker, coordinator, network switch), `to` the
  consumer. The UI may render this undirected, but the stored direction makes
  future mermaid generation from the graph a pure function.
- `type` is a validated string union (`electrical`, `zigbee_binding`,
  `zigbee_network`, `matter_fabric`, `ethernet`, …), plus a free-text `label`
  ("L2 / F7", "Port 12") and an opaque JSON `metadata` blob for per-type
  details. No lookup table: types drive rendering logic in code.
- Junction boxes/breakers being ordinary devices (see
  [devices.md](devices.md)) keeps the graph one node type.
- Edges cascade when either device is deleted.

## Code

- Model: `Connection` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [connections.controller.ts](../../apps/backend/src/app/connections/connections.controller.ts)
  (`/api/connections?deviceId=` matches either end)
- UI: connections card on
  [device-detail-page](../../apps/frontend/src/app/features/devices/device-detail-page.component.ts),
  global grouped view in
  [connections-page](../../apps/frontend/src/app/features/connections/connections-page.component.ts),
  creation via [connection-form-dialog](../../apps/frontend/src/app/features/connections/connection-form-dialog.component.ts)
- DTOs: [connection.dto.ts](../../libs/shared/src/lib/dto/connection.dto.ts)
