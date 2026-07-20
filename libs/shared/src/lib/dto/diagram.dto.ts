import { z } from 'zod';

export interface DiagramDto {
  id: string;
  title: string;
  source: string;
  deviceId: string | null;
  areaId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateDiagramSchema = z.object({
  title: z.string().min(1).max(200),
  source: z.string().max(100000).default(''),
  deviceId: z.string().nullish(),
  areaId: z.string().nullish(),
});
export type CreateDiagramDto = z.infer<typeof CreateDiagramSchema>;

export const UpdateDiagramSchema = CreateDiagramSchema.partial();
export type UpdateDiagramDto = z.infer<typeof UpdateDiagramSchema>;

export const DiagramQuerySchema = z.object({
  deviceId: z.string().optional(),
  areaId: z.string().optional(),
  standalone: z.enum(['1', 'true']).optional(),
});
export type DiagramQueryDto = z.infer<typeof DiagramQuerySchema>;
