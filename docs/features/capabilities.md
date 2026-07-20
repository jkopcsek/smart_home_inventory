# Capabilities

## Intention

Answer "what can this device speak / how is it powered": Matter, Zigbee,
Z-Wave, Thread, Wi-Fi, 230V mains, battery, … and let the device list be
filtered by them ("show every Zigbee device").

## Design

- A **lookup table, not an enum**: `CapabilityType` rows are seeded
  idempotently at startup (`isSystem: true`, undeletable) and users can add
  their own (DALI, 1-Wire, …) without a schema migration. The stable `key`
  is for code/filtering, the `label` for display.
- Device ↔ capability is a join table (`DeviceCapability`) with optional
  per-link JSON metadata (e.g. `{ "zigbeeRole": "router" }`) and notes —
  the same capability can mean different things per device.
- Deleting a type in use, or a system type, returns 409.
- The device form toggles capabilities as chips and diffs against the
  original set on save (upsert/delete per changed key).

## Code

- Models: `CapabilityType`, `DeviceCapability` in
  [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API + seed list: [capabilities.service.ts](../../apps/backend/src/app/capabilities/capabilities.service.ts)
  (`/api/capability-types`, `/api/devices/:id/capabilities/:key`)
- UI: chips in the device form/list; type management on the
  [settings page](../../apps/frontend/src/app/features/settings/settings-page.component.ts)
- DTOs: [capability.dto.ts](../../libs/shared/src/lib/dto/capability.dto.ts)
