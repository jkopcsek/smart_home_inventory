# Attachments

## Intention

Keep manuals, photos, invoices, and wiring diagrams next to the device or area
they belong to — stored inside `/data` so Home Assistant backups include them
automatically.

## Design

- Files live flat in `${DATA_DIR}/uploads/` under a server-generated name
  (`<random>.<sanitized-ext>`); the original filename only exists as DB
  metadata. multer's diskStorage streams straight to the final location — on
  any later failure the service unlinks the file.
- `kind` (`manual|image|invoice|diagram|plan|other`) drives a per-kind mime
  allowlist (e.g. manuals must be PDF) checked in the service so violations
  are clean 400s.
- Ownership is two nullable FKs (`deviceId`/`areaId`) with real cascade
  deletes — deliberately not a polymorphic join for only two owner types.
  Exactly-one-owner is enforced in the service layer.
- Downloads stream via Nest `StreamableFile` with `Content-Disposition` from
  DB (`?inline=1` for `<img>`/PDF viewing). URLs are relative
  (`api/attachments/:id/download`) so they work under the Ingress prefix.
- `kind: "plan"` files back annotated area images and are hidden from the
  generic attachment lists (see [area-images.md](area-images.md)).

## Code

- Model: `Attachment` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [attachments.controller.ts](../../apps/backend/src/app/attachments/attachments.controller.ts),
  storage rules in [file-storage.service.ts](../../apps/backend/src/app/attachments/file-storage.service.ts)
- UI: [attachment-gallery](../../apps/frontend/src/app/features/attachments/attachment-gallery.component.ts)
  (upload with progress, image grid, document list, primary-photo star),
  [file-dropzone](../../apps/frontend/src/app/features/attachments/file-dropzone.component.ts)
