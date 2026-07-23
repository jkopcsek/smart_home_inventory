import { z } from 'zod';
import { EntitySource } from '../enums';

export interface FloorDto {
  id: string;
  name: string;
  level: number | null;
  haFloorId: string | null;
  haOrphaned: boolean;
  source: EntitySource;
  areaCount: number;
  createdAt: string;
  updatedAt: string;
}

export const CreateFloorSchema = z.object({
  name: z.string().min(1).max(200),
  level: z.number().int().nullish(),
});
export type CreateFloorDto = z.infer<typeof CreateFloorSchema>;

export const UpdateFloorSchema = CreateFloorSchema.partial();
export type UpdateFloorDto = z.infer<typeof UpdateFloorSchema>;
