import { z } from 'zod';
import { EntitySource } from '../enums';

export interface AreaDto {
  id: string;
  name: string;
  floor: string | null;
  notes: string | null;
  haAreaId: string | null;
  haOrphaned: boolean;
  source: EntitySource;
  deviceCount: number;
  diagramCount: number;
  createdAt: string;
  updatedAt: string;
}

export const CreateAreaSchema = z.object({
  name: z.string().min(1).max(200),
  floor: z.string().max(100).nullish(),
  notes: z.string().max(10000).nullish(),
});
export type CreateAreaDto = z.infer<typeof CreateAreaSchema>;

export const UpdateAreaSchema = CreateAreaSchema.partial();
export type UpdateAreaDto = z.infer<typeof UpdateAreaSchema>;

export const AreaQuerySchema = z.object({
  q: z.string().optional(),
  floor: z.string().optional(),
});
export type AreaQueryDto = z.infer<typeof AreaQuerySchema>;
