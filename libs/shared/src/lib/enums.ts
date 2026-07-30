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

/** The physical/protocol medium a connection runs over — a user-editable
 *  list (see ConnectionTypeDto), not a fixed union: Settings lets you add
 *  new ones alongside the built-ins (mains_230v, zigbee_network, ...). This
 *  schema just shapes the key itself; whether it's a *real* type is checked
 *  against the live list at the API layer, not here. The same key format is
 *  reused on diagram ports/edges (see WireOrCableType in diagram-content.ts). */
export const ConnectionTypeSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only');
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
