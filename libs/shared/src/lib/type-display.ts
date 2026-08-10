import { WireOrCableType, WireType } from './diagram-content';
import { WIRE_TYPE_COLORS } from './wire-colors';
import { DASH_STYLES, DashStyle } from './dash-style';

function isWireType(type: WireOrCableType): type is WireType {
  return type in WIRE_TYPE_COLORS;
}

/** Looks up a connection type's display color/label — connection types are
 *  user-editable (see ConnectionTypeDto), so unlike WireType there's no
 *  static map to consult; the caller supplies whatever's currently loaded
 *  (e.g. the frontend's ConnectionTypesStore). */
export interface ConnectionTypeLookup {
  label(key: string): string | undefined;
  color(key: string): string | null;
  dash(key: string): string | null;
}

/** Standard color for a NodePort/EdgeData `type` value, whichever granularity it's at. */
export function wireOrCableColor(
  type: WireOrCableType | undefined,
  connectionTypes: ConnectionTypeLookup
): string | null {
  if (!type) return null;
  return isWireType(type) ? WIRE_TYPE_COLORS[type] : connectionTypes.color(type);
}

/** Standard DashStyle for a NodePort/EdgeData `type` value — individual
 *  wires (L1, PE, ...) are always a real physical conductor, so always
 *  'solid'; cable/protocol types carry their own configured style. */
export function wireOrCableDash(
  type: WireOrCableType | undefined,
  connectionTypes: ConnectionTypeLookup
): DashStyle | undefined {
  if (!type) return undefined;
  if (isWireType(type)) return 'solid';
  const style = connectionTypes.dash(type);
  return style && (DASH_STYLES as readonly string[]).includes(style) ? (style as DashStyle) : undefined;
}

/** Display label — wire types show as their own literal (L1, PE, ...); cable
 *  types get their human-readable label (e.g. "24V DC"). */
export function wireOrCableLabel(
  type: WireOrCableType | undefined,
  connectionTypes: ConnectionTypeLookup
): string | undefined {
  if (!type) return undefined;
  return isWireType(type) ? type : connectionTypes.label(type);
}
