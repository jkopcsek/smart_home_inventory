import { z } from 'zod';

/** How a connection type clusters for display — a flat list mixes wired
 *  cables in with wireless protocols (e.g. Zigbee has no cable at all),
 *  which reads wrong wherever types are grouped (a diagram port's type
 *  picker, the Connections page's filter chips). */
export const CONNECTION_TYPE_GROUPS = ['wired', 'wireless', 'other'] as const;
export const ConnectionTypeGroupSchema = z.enum(CONNECTION_TYPE_GROUPS);
export type ConnectionTypeGroup = z.infer<typeof ConnectionTypeGroupSchema>;

export interface ConnectionTypeDto {
  id: string;
  key: string;
  label: string;
  group: ConnectionTypeGroup;
  color: string;
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
});
export type CreateConnectionTypeDto = z.infer<typeof CreateConnectionTypeSchema>;

export const UpdateConnectionTypeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  group: ConnectionTypeGroupSchema.optional(),
  color: z.string().min(1).max(30).optional(),
});
export type UpdateConnectionTypeDto = z.infer<typeof UpdateConnectionTypeSchema>;
