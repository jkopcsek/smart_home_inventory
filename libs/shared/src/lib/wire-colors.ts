import { WireType } from './diagram-content';

/** All selectable wire types, in display order. */
export const WIRE_TYPES: WireType[] = ['L1', 'L2', 'L3', 'N', 'PE', 'DC+', 'DC-'];

/**
 * Standard colors for each wire type — applied once when the type is set (an
 * edge's or port's own `color` can then be changed independently).
 *
 * L1/L2/L3/N/PE follow DIN VDE 0293-308 / IEC 60446-3. DC+/DC- follow the
 * red/black convention near-universal for low-voltage (12V/24V) DC wiring
 * (batteries, LED strips, alarm/access-control systems) — not a formal
 * DIN/IEC code the way the AC colors are, just very consistent practice.
 */
export const WIRE_TYPE_COLORS: Record<WireType, string> = {
  L1: '#8b5a2b',
  L2: '#1a1a1a',
  L3: '#808080',
  N: '#1565c0',
  PE: '#7cb342',
  'DC+': '#c62828',
  'DC-': '#1a1a1a',
};
