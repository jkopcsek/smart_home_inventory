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

export const CONNECTION_TYPES = [
  'electrical',
  'zigbee_binding',
  'zigbee_network',
  'zwave_network',
  'matter_fabric',
  'thread',
  'ethernet',
  'wifi',
  'knx',
  'other',
] as const;
export const ConnectionTypeSchema = z.enum(CONNECTION_TYPES);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

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
