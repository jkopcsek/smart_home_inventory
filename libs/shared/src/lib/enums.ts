import { z } from 'zod';

export const DEVICE_STATUSES = [
  'installed',
  'stored',
  'retired',
  'planned',
  'broken',
] as const;
export const DeviceStatusSchema = z.enum(DEVICE_STATUSES);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const DEVICE_CATEGORIES = [
  'light',
  'switch_actor',
  'sensor',
  'thermostat',
  'media',
  'appliance',
  'breaker',
  'junction_box',
  'outlet',
  'wall_switch',
  'network',
  'hub',
  'camera',
  'other',
] as const;
export const DeviceCategorySchema = z.enum(DEVICE_CATEGORIES);
export type DeviceCategory = z.infer<typeof DeviceCategorySchema>;

export const ATTACHMENT_KINDS = [
  'manual',
  'image',
  'invoice',
  'diagram',
  'plan',
  'other',
] as const;
export const AttachmentKindSchema = z.enum(ATTACHMENT_KINDS);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

/** The physical/protocol medium a connection runs over. The wired-power
 *  values (mains_230v/dc_24v/dc_12v/usb) are a cable-level granularity —
 *  coarser than picking out individual conductors (see WireType in
 *  diagram-content.ts) but specific enough to tell cables apart at a glance;
 *  the same enum is reused for that purpose on diagram ports/edges. */
export const CONNECTION_TYPES = [
  'mains_230v',
  'dc_24v',
  'dc_12v',
  'usb',
  'ethernet',
  'wifi',
  'zigbee_binding',
  'zigbee_network',
  'zwave_network',
  'matter_fabric',
  'thread',
  'knx',
  'other',
] as const;
export const ConnectionTypeSchema = z.enum(CONNECTION_TYPES);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  mains_230v: '230V mains',
  dc_24v: '24V DC',
  dc_12v: '12V DC',
  usb: 'USB',
  ethernet: 'Ethernet',
  wifi: 'Wi-Fi',
  zigbee_binding: 'Zigbee binding',
  zigbee_network: 'Zigbee network',
  zwave_network: 'Z-Wave network',
  matter_fabric: 'Matter fabric',
  thread: 'Thread',
  knx: 'KNX',
  other: 'Other',
};

export const CAPABILITY_CATEGORIES = [
  'protocol',
  'network',
  'power',
  'other',
] as const;
export const CapabilityCategorySchema = z.enum(CAPABILITY_CATEGORIES);
export type CapabilityCategory = z.infer<typeof CapabilityCategorySchema>;

export const ENTITY_SOURCES = ['manual', 'ha'] as const;
export const EntitySourceSchema = z.enum(ENTITY_SOURCES);
export type EntitySource = z.infer<typeof EntitySourceSchema>;

export const HA_MODES = ['supervisor', 'direct', 'mock'] as const;
export type HaMode = (typeof HA_MODES)[number];
