import { ConnectionType } from './enums';

export interface ConnectionTypeGroup {
  label: string;
  types: ConnectionType[];
}

/**
 * How the connection types cluster for display — a flat list mixes wired
 * cables in with wireless protocols (e.g. Zigbee has no cable at all), which
 * reads wrong wherever they're grouped (a diagram port's type picker, the
 * Connections page's filter chips). Keep this the single source of truth for
 * that grouping and exhaustive over every ConnectionType value —
 * CONNECTION_TYPES_ORDERED below is derived from it, so a value missing here
 * would silently disappear from every picker.
 *
 * knx is filed under wired: the common real-world deployment is the wired
 * twisted-pair bus, not the far less common KNX-RF variant.
 */
export const CONNECTION_TYPE_GROUPS: ConnectionTypeGroup[] = [
  { label: 'Wired', types: ['mains_230v', 'dc_24v', 'dc_12v', 'usb', 'ethernet', 'knx'] },
  {
    label: 'Wireless',
    types: ['wifi', 'zigbee_binding', 'zigbee_network', 'zwave_network', 'matter_fabric', 'thread'],
  },
  { label: 'Other', types: ['other'] },
];

/** All selectable connection/cable types, in display order (grouped: wired, then wireless, then other). */
export const CONNECTION_TYPES_ORDERED: ConnectionType[] = CONNECTION_TYPE_GROUPS.flatMap((g) => g.types);

/**
 * Standard colors for each connection/cable type — applied once when the
 * type is set (a connection's, edge's, or port's own `color` can then be
 * changed independently). Wired-power values follow the same real-world
 * conventions as WIRE_TYPE_COLORS (brown mains, red/orange low-voltage DC);
 * the rest are loose associations with each protocol's own branding, since
 * there's no formal standard for a "wire color" that doesn't carry current.
 */
export const CONNECTION_TYPE_COLORS: Record<ConnectionType, string> = {
  mains_230v: '#8b5a2b',
  dc_24v: '#c62828',
  dc_12v: '#e65100',
  usb: '#455a64',
  ethernet: '#1565c0',
  wifi: '#6a1b9a',
  zigbee_binding: '#66bb6a',
  zigbee_network: '#2e7d32',
  zwave_network: '#4527a0',
  matter_fabric: '#212121',
  thread: '#00838f',
  knx: '#00897b',
  other: '#757575',
};
