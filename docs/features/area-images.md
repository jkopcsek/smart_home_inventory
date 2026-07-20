# Annotated area images

## Intention

An area can have **multiple annotated images**, each documenting a different
aspect: the floor plan, a photo of the distribution box, a wall opened during
renovation showing cable runs. On each image you pin devices, mark junction
boxes, draw cable paths and add labels.

## Design

- `AreaImage` = name + description + one image attachment (`kind: "plan"`) +
  one JSON annotation blob. The backend validates the blob against the shared
  zod schema but never interprets it.
- Annotation schema ([annotations.ts](../../libs/shared/src/lib/annotations.ts)):
  a discriminated union of `pin` (optionally linked to a device), `rect`,
  `polyline` (cable runs), and `label`. **All coordinates are normalized
  0..1** relative to the image's natural size, so replacing the image with a
  higher-resolution scan keeps every annotation in place; the natural size is
  probed server-side on upload (`image-size`).
- Concurrency: optimistic locking. The client sends the `version` it loaded
  with `PUT /api/area-images/:id/annotations`; a mismatch is a 409 and the
  version increments on every successful write.
- The editor is **plain SVG + Angular signals** (no canvas library):
  annotations render declaratively from state, so hit-testing, hover and
  selection are native DOM behavior. Pan/zoom manipulates the SVG `viewBox`;
  screen↔image coordinate conversion (including `xMidYMid meet` letterboxing)
  and cursor-anchored zoom live in a small pure-math module with tests.
  Constant on-screen sizes for pins/strokes are achieved by dividing by the
  current view scale.

## Code

- Model: `AreaImage` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [area-images.controller.ts](../../apps/backend/src/app/area-images/area-images.controller.ts)
  (`/api/areas/:id/images`, `/api/area-images/:id/annotations`)
- Editor: [area-image-page.component.ts](../../apps/frontend/src/app/features/image-editor/area-image-page.component.ts)
- Coordinate math: [editor-math.ts](../../apps/frontend/src/app/features/image-editor/editor-math.ts)
  (+ [spec](../../apps/frontend/src/app/features/image-editor/editor-math.spec.ts))
