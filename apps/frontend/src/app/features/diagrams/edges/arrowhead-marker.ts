/**
 * Arrowhead markers scale 1:1 with stroke-width by SVG default
 * (markerUnits="strokeWidth"), which reads fine for a thin signal wire but
 * balloons way past readable once the edge width picker lets someone pick
 * an 8px pipe. A fixed size (markerUnits="userSpaceOnUse") fixes that but
 * then looks disconnected from the line at the thick end. These tiers are
 * the middle ground: a handful of fixed sizes, picked per-edge by its own
 * width, so the arrowhead still grows with a thicker line — just capped,
 * not linear. Registered as real `<marker>` elements (one set per tier) in
 * DiagramCanvasComponent; this file owns the tier list and the id naming
 * convention shared between that registration and the lookups below.
 *
 * The tiered id (e.g. 'arrow-md') has to be the value actually stored on
 * the edge's own sourceArrowhead/targetArrowhead — ng-diagram's base edge
 * component resolves its marker as `edge().sourceArrowhead ?? <input>`, so
 * a plain template-input override is silently shadowed whenever the edge
 * itself already has a value (which, once an arrowhead is picked, it always
 * does). DiagramCanvasComponent re-derives the tier (via arrowheadTieredId)
 * both when an arrowhead is picked and whenever the edge's width changes,
 * and arrowheadKind() strips the tier back off for the picker UI, which
 * only ever deals in the abstract 'arrow' | 'dot' kind.
 */
export interface ArrowheadSizeTier {
  /** Appended to the base kind ('arrow' | 'dot') to get the registered marker id. */
  suffix: string;
  /** Edge widths at or below this pick the tier — Infinity for the last one. */
  maxWidth: number;
  arrow: number;
  dot: number;
}

export const ARROWHEAD_SIZE_TIERS: ArrowheadSizeTier[] = [
  { suffix: '-sm', maxWidth: 2, arrow: 14, dot: 10 },
  { suffix: '-md', maxWidth: 4, arrow: 18, dot: 13 },
  { suffix: '-lg', maxWidth: Infinity, arrow: 24, dot: 17 },
];

/** Same default as WireEdgeComponent's strokeWidth fallback (ng-diagram's
 *  own --edge-stroke-width, 2) — an edge with no explicit width still needs
 *  a tier to pick. */
const DEFAULT_EDGE_WIDTH = 2;

/** 'arrow' | 'dot' (+ optional trailing tier from a previous call) → the
 *  registered marker id for the given edge width, e.g. 'arrow-md'. */
export function arrowheadTieredId(kind: string, width: number | undefined): string {
  const base = arrowheadKind(kind);
  const w = width ?? DEFAULT_EDGE_WIDTH;
  const tier = ARROWHEAD_SIZE_TIERS.find((t) => w <= t.maxWidth) ?? ARROWHEAD_SIZE_TIERS[ARROWHEAD_SIZE_TIERS.length - 1];
  return base + tier.suffix;
}

/** Strips a tier suffix (if any) back off a stored marker id, e.g.
 *  'arrow-md' → 'arrow' — what the picker UI compares against, since it
 *  only ever offers the abstract kind, not a specific size. */
export function arrowheadKind(id: string | undefined): string | undefined {
  if (!id) return id;
  const tier = ARROWHEAD_SIZE_TIERS.find((t) => id.endsWith(t.suffix));
  return tier ? id.slice(0, -tier.suffix.length) : id;
}
