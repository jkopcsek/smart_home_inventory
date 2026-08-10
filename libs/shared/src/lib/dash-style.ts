import { z } from 'zod';

/** A named line style, not raw SVG stroke-dasharray coordinates — stored on
 *  both ConnectionType (the per-type preset) and EdgeData (an edge's own,
 *  independently-editable value, same "one-shot preset then free" pattern
 *  as color). Keeping the actual pixel pattern out of stored data means
 *  retuning what "dashed" looks like is a one-place change (see
 *  DASH_STYLE_PATTERNS below), not a data migration. */
export const DASH_STYLES = ['solid', 'dashed', 'dotted', 'dash-dot'] as const;
export const DashStyleSchema = z.enum(DASH_STYLES);
export type DashStyle = z.infer<typeof DashStyleSchema>;

/** SVG stroke-dasharray for each style, fed straight into ng-diagram's
 *  edge `strokeDasharray` input. undefined (solid) omits the attribute
 *  entirely rather than passing an empty string. */
export const DASH_STYLE_PATTERNS: Record<DashStyle, string | undefined> = {
  solid: undefined,
  dashed: '8 4',
  dotted: '1 4',
  'dash-dot': '8 4 1 4',
};

export const DASH_STYLE_LABELS: Record<DashStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  'dash-dot': 'Dash-dot',
};
