# Areas

## Intention

Areas mirror Home Assistant's own top-level location concept (deliberately not
"rooms" — same naming as HA so synced data feels native). They group devices,
annotated images, attachments, and diagrams. Floors are a free-text label on
the area for now; syncing HA's floor registry is a possible later step.

## Design

- An area is either **manual** (`source: "manual"`) or **HA-synced**
  (`source: "ha"`, `haAreaId` set). Sync never deletes: an area that vanished
  from HA is flagged `haOrphaned` and shown with a warning icon.
- `haName` stores the last name seen from HA — the sync uses it to detect
  whether the user renamed the area locally (see [ha-sync.md](ha-sync.md)).
- Deleting an area keeps its devices (FK `SetNull`) but cascades images and
  attachments.
- The list page groups by floor; notes are a plain free-text field.

## Code

- Model: `Area` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [areas.controller.ts](../../apps/backend/src/app/areas/areas.controller.ts) (`/api/areas`)
- UI: [area-list-page](../../apps/frontend/src/app/features/areas/area-list-page.component.ts),
  [area-detail-page](../../apps/frontend/src/app/features/areas/area-detail-page.component.ts)
- DTOs: [area.dto.ts](../../libs/shared/src/lib/dto/area.dto.ts)
