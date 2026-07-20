# Devices

## Intention

The core inventory record: everything from a Hue bulb to a circuit breaker or
junction box is a device. Tracks identity (manufacturer, model, serial),
purchase info, a product link, free-text notes, lifecycle status, and the area
it lives in.

## Design

- **Electrical infrastructure is modeled as devices too** (`category:
  "breaker" | "junction_box" | ...`). This keeps the connection graph
  homogeneous — one node type — which makes later graph features (e.g.
  generating mermaid from connections) trivial.
- Prices are integer cents (`purchasePriceCents`) because Prisma has no
  Decimal on SQLite.
- HA-synced devices carry `haDeviceId` / `haName` / `haAreaIdAtSync` for the
  merge rules (see [ha-sync.md](ha-sync.md)); manual devices leave them null.
- One attachment can be marked as the **primary image** (named Prisma relation
  with `SetNull` on delete; must be an image owned by the same device —
  enforced in `DevicesService.setPrimaryImage`).
- List filtering (search, area, status, capability) is done server-side; the
  frontend mirrors filters into URL query params so list state survives
  back-navigation.

## Code

- Model: `Device` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [devices.controller.ts](../../apps/backend/src/app/devices/devices.controller.ts) (`/api/devices`)
- UI: [device-list-page](../../apps/frontend/src/app/features/devices/device-list-page.component.ts),
  [device-detail-page](../../apps/frontend/src/app/features/devices/device-detail-page.component.ts),
  [device-form-page](../../apps/frontend/src/app/features/devices/device-form-page.component.ts)
- DTOs: [device.dto.ts](../../libs/shared/src/lib/dto/device.dto.ts)
