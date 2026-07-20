import { z } from 'zod';
import { CapabilityCategory, CapabilityCategorySchema } from '../enums';

export interface CapabilityTypeDto {
  id: string;
  key: string;
  label: string;
  category: CapabilityCategory;
  isSystem: boolean;
  deviceCount: number;
}

export const CreateCapabilityTypeSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only'),
  label: z.string().min(1).max(100),
  category: CapabilityCategorySchema.default('other'),
});
export type CreateCapabilityTypeDto = z.infer<typeof CreateCapabilityTypeSchema>;

export const UpdateCapabilityTypeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  category: CapabilityCategorySchema.optional(),
});
export type UpdateCapabilityTypeDto = z.infer<typeof UpdateCapabilityTypeSchema>;

export interface DeviceCapabilityDto {
  capabilityTypeId: string;
  key: string;
  label: string;
  category: CapabilityCategory;
  metadata: Record<string, unknown> | null;
  notes: string | null;
}

export const SetDeviceCapabilitySchema = z.object({
  metadata: z.record(z.string(), z.unknown()).nullish(),
  notes: z.string().max(10000).nullish(),
});
export type SetDeviceCapabilityDto = z.infer<typeof SetDeviceCapabilitySchema>;
