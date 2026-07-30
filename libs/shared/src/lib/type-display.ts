import { WireOrCableType, WireType } from './diagram-content';
import { WIRE_TYPE_COLORS } from './wire-colors';

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
}

/** Standard color for a NodePort/EdgeData `type` value, whichever granularity it's at. */
export function wireOrCableColor(
  type: WireOrCableType | undefined,
  connectionTypes: ConnectionTypeLookup
): string | null {
  if (!type) return null;
  return isWireType(type) ? WIRE_TYPE_COLORS[type] : connectionTypes.color(type);
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
