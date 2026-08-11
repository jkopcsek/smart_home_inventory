import { z } from 'zod';
import { ConnectionTypeSchema } from './enums';
import { DashStyleSchema } from './dash-style';

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
  z.object({ kind: z.literal('connection'), connectionId: z.string().min(1) }),
]);
export type NodeLink = z.infer<typeof NodeLinkSchema>;

export const PortDirectionSchema = z.enum(['in', 'out']);
export type PortDirection = z.infer<typeof PortDirectionSchema>;

/** German/European AC conductor designations (DIN VDE 0293-308 / IEC 60446-3),
 *  plus the red/black DC+/DC- convention common for low-voltage (12V/24V)
 *  wiring — an industry convention (LED strips, alarms, batteries), not a
 *  formal DIN/IEC code the way the AC ones are. */
export const WireTypeSchema = z.enum(['L1', 'L2', 'L3', 'N', 'PE', 'DC+', 'DC-']);
export type WireType = z.infer<typeof WireTypeSchema>;

/**
 * A single field spanning two granularities: an individual conductor
 * (WireType: L1/L2/L3/N/PE/DC+/DC-) or a whole cable (ConnectionType: 230V
 * mains, 24V/12V DC, USB, Ethernet, Zigbee, ...) — the same enum used for a
 * real Connection's type. The UI presents these as one picker (grouped into
 * Wire/Wired/Wireless/Other), so this stays one field rather than two —
 * two separate optional fields meant "pick one, not both" had to be kept in
 * sync by hand and could silently end up both set.
 */
export const WireOrCableTypeSchema = z.union([WireTypeSchema, ConnectionTypeSchema]);
export type WireOrCableType = z.infer<typeof WireOrCableTypeSchema>;

export const NodePortSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(60),
  direction: PortDirectionSchema,
  /** Setting this applies the type's standard color to the port pin once —
   *  same one-shot convenience as an edge's type. */
  type: WireOrCableTypeSchema.optional(),
});
export type NodePort = z.infer<typeof NodePortSchema>;

const NodeDataBase = z.object({
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  borderColor: z.string().optional(),
  /** Box-ports only: the header bar's background, independent of `color`
   *  (which drives the card's border there). Meaningless on other shapes. */
  headerColor: z.string().optional(),
  /** When set, a 'box'/'image' renders border-only (no fill) — lets them be
   *  used as plain grouping outlines without hiding whatever's behind them. */
  transparent: z.boolean().optional(),
  link: NodeLinkSchema.optional(),
  /** Key into the frontend's curated node-icon registry (see node-icons.ts)
   *  — not raw SVG/path data, so the registry can change without touching
   *  saved diagrams. Supported by dot/box/box-ports/image; meaningless on a
   *  background-image node so the UI doesn't offer it there. */
  icon: z.string().optional(),
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
  /** Inputs/outputs as two side-by-side columns (ports stacked top-to-bottom
   *  within each) vs. two stacked rows (ports laid out left-to-right within
   *  each, pins on the top/bottom edge instead of left/right) — the latter
   *  fits a long list of ports (e.g. a row of breakers) in a wide, short box
   *  instead of a tall, narrow one. Unset means 'vertical', matching every
   *  box-ports node saved before this existed. */
  layout: z.enum(['vertical', 'horizontal']).optional(),
});
export type BoxPortsNodeData = z.infer<typeof BoxPortsNodeDataSchema>;

/** A freely draggable/resizable photo — unlike the locked full-bleed
 *  'background-image' shape it's otherwise modeled on. The photo is its own
 *  `imageAttachmentId` field, deliberately separate from `link` — so the
 *  node can ALSO link to a real Area/Device/Diagram/Connection without that
 *  competing with what photo it shows (link's own 'image' kind still exists
 *  for other shapes, e.g. a 'box' rendering a photo in place of its label).
 *  No color/border/icon — see ImageNodeComponent. */
export const ImageNodeDataSchema = NodeDataBase.extend({
  shape: z.literal('image'),
  imageAttachmentId: z.string().optional(),
});
export type ImageNodeData = z.infer<typeof ImageNodeDataSchema>;

/** A full-bleed backdrop image (e.g. a floor plan) — no ports, sent to the
 *  back of the stack. Usually locked (not draggable/resizable) so it doesn't
 *  get bumped while working on the diagram; unlock it to reposition/resize. */
export const BackgroundImageNodeDataSchema = NodeDataBase.extend({
  shape: z.literal('background-image'),
});
export type BackgroundImageNodeData = z.infer<typeof BackgroundImageNodeDataSchema>;

/** A minimal draggable point — not labeled, colored, iconed, or linkable.
 *  Exists only as one end of an annotation Line/polyline (see the diagram
 *  canvas's line-drawing tool): the line itself is a plain 'wire' edge
 *  between two of these, so each vertex stays independently draggable for
 *  free instead of needing custom multi-point-edge handle logic. */
export const AnchorNodeDataSchema = NodeDataBase.extend({ shape: z.literal('anchor') });
export type AnchorNodeData = z.infer<typeof AnchorNodeDataSchema>;

export const NodeDataSchema = z.discriminatedUnion('shape', [
  DotNodeDataSchema,
  BoxNodeDataSchema,
  BoxPortsNodeDataSchema,
  BackgroundImageNodeDataSchema,
  AnchorNodeDataSchema,
  ImageNodeDataSchema,
]);
export type NodeData = z.infer<typeof NodeDataSchema>;

/** Optionally represents a real Connection between devices; otherwise a free-standing labeled edge. */
export const EdgeDataSchema = z.object({
  connectionId: z.string().min(1).optional(),
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  /** Setting this applies the type's standard color once — color can then be
   *  changed independently without affecting or clearing the type. See
   *  NodePort.type — same field, same reasoning. */
  type: WireOrCableTypeSchema.optional(),
  /** Same one-shot-preset-then-independently-editable treatment as color —
   *  see DashStyle. */
  dash: DashStyleSchema.optional(),
  /** Stroke width in px. Unset renders at ng-diagram's own default width —
   *  same "unset = library default" treatment as color/dash above. */
  width: z.number().min(1).max(20).optional(),
});
export type EdgeData = z.infer<typeof EdgeDataSchema>;

const Point = z.object({ x: z.number(), y: z.number() });
const Size = z.object({ width: z.number(), height: z.number() });

export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['dot', 'box', 'box-ports', 'background-image', 'anchor', 'image']).optional(),
  position: Point,
  size: Size.optional(),
  autoSize: z.boolean().optional(),
  resizable: z.boolean().optional(),
  /** false = locked in place (no drag/resize) — handy for a photo used as a backdrop. */
  draggable: z.boolean().optional(),
  /** Set by ng-diagram's bringToFront/sendToBack commands — must round-trip
   *  through save/load or layering resets every time the diagram reopens. */
  zOrder: z.number().optional(),
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
  /** Edge template key — 'wire' selects the custom (colorable) edge template. */
  type: z.string().optional(),
  /** Routed path; present once ng-diagram (or a manual reshape) has computed one. */
  points: z.array(Point).optional(),
  /** Routing algorithm name (e.g. 'orthogonal'). */
  routing: z.string().optional(),
  /** 'manual' after the user drags a segment — the route is then taken as-is
   *  instead of recomputed by the routing algorithm on every change. */
  routingMode: z.enum(['manual', 'auto']).optional(),
  /** Set by ng-diagram's bringToFront/sendToBack commands — must round-trip
   *  through save/load or layering resets every time the diagram reopens. */
  zOrder: z.number().optional(),
  data: EdgeDataSchema.optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramViewportSchema = z.object({ x: z.number(), y: z.number(), scale: z.number() });
export type DiagramViewport = z.infer<typeof DiagramViewportSchema>;

// Named `schemaVersion`, not `version` — the row-level optimistic-concurrency
// counter on Diagram already owns the name `version` in payloads that carry both.
export const DiagramContentSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
  /** Last pan/zoom the user left the canvas at — restored on reopen instead
   *  of defaulting to zoomToFit(). Absent on older content / a brand-new diagram. */
  viewport: DiagramViewportSchema.optional(),
});
export type DiagramContent = z.infer<typeof DiagramContentSchema>;

export const EMPTY_DIAGRAM_CONTENT: DiagramContent = {
  schemaVersion: 1,
  nodes: [],
  edges: [],
};
