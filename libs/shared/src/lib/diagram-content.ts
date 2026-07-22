import { z } from 'zod';

/**
 * Structural node/edge fields (id, position, size, source, target, ...) are
 * NOT reinvented here — they mirror ng-diagram's own Node<T>/Edge<T> shape.
 * Only the `data` payload is app-specific and validated.
 *
 * A node's visual form ("shape") and what it references ("link") are
 * orthogonal: any shape can optionally link to an Area, a Device, another
 * Diagram, or an image Attachment, rather than each combination being its
 * own kind.
 */

export const NodeLinkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('area'), areaId: z.string().min(1) }),
  z.object({ kind: z.literal('device'), deviceId: z.string().min(1) }),
  z.object({ kind: z.literal('diagram'), diagramId: z.string().min(1) }),
  z.object({ kind: z.literal('image'), attachmentId: z.string().min(1) }),
]);
export type NodeLink = z.infer<typeof NodeLinkSchema>;

export const PortDirectionSchema = z.enum(['in', 'out']);
export type PortDirection = z.infer<typeof PortDirectionSchema>;

export const NodePortSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(60),
  direction: PortDirectionSchema,
});
export type NodePort = z.infer<typeof NodePortSchema>;

const NodeDataBase = z.object({
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  borderColor: z.string().optional(),
  link: NodeLinkSchema.optional(),
  /** true = used as a backdrop: locked, sent to back, excluded from click-selection.
   *  Only meaningful for a box linked to an image. */
  background: z.boolean().optional(),
});

/** A small labeled marker. */
export const DotNodeDataSchema = NodeDataBase.extend({ shape: z.literal('dot') });
export type DotNodeData = z.infer<typeof DotNodeDataSchema>;

/** A labeled, filled box — or, when linked to an image, renders that photo. */
export const BoxNodeDataSchema = NodeDataBase.extend({ shape: z.literal('box') });
export type BoxNodeData = z.infer<typeof BoxNodeDataSchema>;

/** A box with a user-configurable number of named input/output ports
 *  (e.g. a switch box or junction box) — modeled on ng-diagram's
 *  AV-schematic demo's DevicePort pattern. */
export const BoxPortsNodeDataSchema = NodeDataBase.extend({
  shape: z.literal('box-ports'),
  ports: z.array(NodePortSchema),
});
export type BoxPortsNodeData = z.infer<typeof BoxPortsNodeDataSchema>;

export const NodeDataSchema = z.discriminatedUnion('shape', [
  DotNodeDataSchema,
  BoxNodeDataSchema,
  BoxPortsNodeDataSchema,
]);
export type NodeData = z.infer<typeof NodeDataSchema>;

/** Optionally represents a real Connection between devices; otherwise a free-standing labeled edge. */
export const EdgeDataSchema = z.object({
  connectionId: z.string().min(1).optional(),
  label: z.string().max(200).optional(),
  color: z.string().optional(),
});
export type EdgeData = z.infer<typeof EdgeDataSchema>;

const Point = z.object({ x: z.number(), y: z.number() });
const Size = z.object({ width: z.number(), height: z.number() });

export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['dot', 'box', 'box-ports']).optional(),
  position: Point,
  size: Size.optional(),
  autoSize: z.boolean().optional(),
  resizable: z.boolean().optional(),
  /** false = locked in place (no drag/resize) — handy for a photo used as a backdrop. */
  draggable: z.boolean().optional(),
  data: NodeDataSchema,
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /** Which named port on the source/target node this wire attaches to, if any. */
  sourcePort: z.string().optional(),
  targetPort: z.string().optional(),
  /** Arrowhead marker id shown at that end, if any — see the registered 'arrow' marker. */
  sourceArrowhead: z.string().optional(),
  targetArrowhead: z.string().optional(),
  data: EdgeDataSchema.optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

// Named `schemaVersion`, not `version` — the row-level optimistic-concurrency
// counter on Diagram already owns the name `version` in payloads that carry both.
export const DiagramContentSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});
export type DiagramContent = z.infer<typeof DiagramContentSchema>;

export const EMPTY_DIAGRAM_CONTENT: DiagramContent = {
  schemaVersion: 1,
  nodes: [],
  edges: [],
};
