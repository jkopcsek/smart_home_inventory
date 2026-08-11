import { z } from 'zod';
import { DashStyleSchema } from '../dash-style';

/** How a connection type clusters for display — a flat list mixes wired
 *  cables in with wireless protocols (e.g. Zigbee has no cable at all),
 *  which reads wrong wherever types are grouped (a diagram port's type
 *  picker, the Connections page's filter chips). 'plumbing' and
 *  'ventilation' cover physical runs that are neither electrical wire nor
 *  radio (water/gas/heating pipes, air ducts) — lumping them into 'wired'
 *  would misdescribe them, and 'other' would bury them next to anything
 *  uncategorized. */
export const CONNECTION_TYPE_GROUPS = [
  'wired',
  'wireless',
  'plumbing',
  'ventilation',
  'other',
] as const;
export const ConnectionTypeGroupSchema = z.enum(CONNECTION_TYPE_GROUPS);
export type ConnectionTypeGroup = z.infer<typeof ConnectionTypeGroupSchema>;

export interface ConnectionTypeDto {
  id: string;
  key: string;
  label: string;
  group: ConnectionTypeGroup;
  color: string;
  dash: string;
  isSystem: boolean;
  connectionCount: number;
}

export const CreateConnectionTypeSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only'),
  label: z.string().min(1).max(100),
  group: ConnectionTypeGroupSchema.default('other'),
  color: z.string().min(1).max(30),
  dash: DashStyleSchema.default('solid'),
});
export type CreateConnectionTypeDto = z.infer<typeof CreateConnectionTypeSchema>;

export const UpdateConnectionTypeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  group: ConnectionTypeGroupSchema.optional(),
  color: z.string().min(1).max(30).optional(),
  dash: DashStyleSchema.optional(),
});
export type UpdateConnectionTypeDto = z.infer<typeof UpdateConnectionTypeSchema>;
