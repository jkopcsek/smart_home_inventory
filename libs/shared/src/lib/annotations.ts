import { z } from 'zod';
import { ConnectionTypeSchema } from './enums';

/**
 * Annotation coordinates are normalized to 0..1 relative to the natural size
 * of the underlying image, so annotations survive re-uploading the image at a
 * different resolution.
 */
const Coord = z.number().min(0).max(1);

const AnnotationBase = z.object({
  id: z.string().min(1),
  color: z.string().optional(),
});

export const PinAnnotationSchema = AnnotationBase.extend({
  kind: z.literal('pin'),
  x: Coord,
  y: Coord,
  deviceId: z.string().optional(),
  /** Link to another AreaImage of the same area (e.g. a floor-plan pin opening the switch-box photo). */
  areaImageId: z.string().optional(),
  label: z.string().optional(),
});
export type PinAnnotation = z.infer<typeof PinAnnotationSchema>;

export const RectAnnotationSchema = AnnotationBase.extend({
  kind: z.literal('rect'),
  x: Coord,
  y: Coord,
  w: Coord,
  h: Coord,
  label: z.string().optional(),
});
export type RectAnnotation = z.infer<typeof RectAnnotationSchema>;

export const PolylineAnnotationSchema = AnnotationBase.extend({
  kind: z.literal('polyline'),
  points: z.array(z.object({ x: Coord, y: Coord })).min(2),
  connectionType: ConnectionTypeSchema.optional(),
  label: z.string().optional(),
});
export type PolylineAnnotation = z.infer<typeof PolylineAnnotationSchema>;

export const LabelAnnotationSchema = AnnotationBase.extend({
  kind: z.literal('label'),
  x: Coord,
  y: Coord,
  text: z.string().min(1),
  fontSize: z.number().positive().optional(),
});
export type LabelAnnotation = z.infer<typeof LabelAnnotationSchema>;

export const AnnotationItemSchema = z.discriminatedUnion('kind', [
  PinAnnotationSchema,
  RectAnnotationSchema,
  PolylineAnnotationSchema,
  LabelAnnotationSchema,
]);
export type AnnotationItem = z.infer<typeof AnnotationItemSchema>;

export const PlanAnnotationsSchema = z.object({
  version: z.literal(1),
  items: z.array(AnnotationItemSchema),
});
export type PlanAnnotations = z.infer<typeof PlanAnnotationsSchema>;

export const EMPTY_ANNOTATIONS: PlanAnnotations = { version: 1, items: [] };
