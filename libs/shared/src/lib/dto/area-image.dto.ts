import { z } from 'zod';
import { PlanAnnotations, PlanAnnotationsSchema } from '../annotations';
import { AreaImageKind, AreaImageKindSchema } from '../enums';

export interface AreaImageDto {
  id: string;
  areaId: string;
  name: string;
  kind: AreaImageKind | null;
  description: string | null;
  imageAttachmentId: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  annotations: PlanAnnotations;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const CreateAreaImageSchema = z.object({
  name: z.string().min(1).max(200),
  kind: AreaImageKindSchema.nullish(),
  description: z.string().max(2000).nullish(),
});
export type CreateAreaImageDto = z.infer<typeof CreateAreaImageSchema>;

export const UpdateAreaImageSchema = CreateAreaImageSchema.partial();
export type UpdateAreaImageDto = z.infer<typeof UpdateAreaImageSchema>;

export const PutAnnotationsSchema = z.object({
  version: z.number().int().positive(),
  annotations: PlanAnnotationsSchema,
});
export type PutAnnotationsDto = z.infer<typeof PutAnnotationsSchema>;
