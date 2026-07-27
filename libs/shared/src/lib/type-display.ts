import { WireOrCableType, WireType } from './diagram-content';
import { WIRE_TYPE_COLORS } from './wire-colors';
import { CONNECTION_TYPE_COLORS } from './connection-colors';
import { CONNECTION_TYPE_LABELS } from './enums';

function isWireType(type: WireOrCableType): type is WireType {
  return type in WIRE_TYPE_COLORS;
}

/** Standard color for a NodePort/EdgeData `type` value, whichever granularity it's at. */
export function wireOrCableColor(type: WireOrCableType | undefined): string | null {
  if (!type) return null;
  return isWireType(type) ? WIRE_TYPE_COLORS[type] : CONNECTION_TYPE_COLORS[type];
}

/** Display label — wire types show as their own literal (L1, PE, ...); cable
 *  types get their human-readable label (e.g. "24V DC"). */
export function wireOrCableLabel(type: WireOrCableType | undefined): string | undefined {
  if (!type) return undefined;
  return isWireType(type) ? type : CONNECTION_TYPE_LABELS[type];
}
