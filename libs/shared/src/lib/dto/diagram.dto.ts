import { z } from 'zod';
import { DiagramContent, DiagramContentSchema } from '../diagram-content';

export interface DiagramDto {
  id: string;
  title: string;
  content: DiagramContent;
  version: number;
  deviceId: string | null;
  areaId: string | null;
  previewAttachmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateDiagramSchema = z.object({
  title: z.string().min(1).max(200),
  deviceId: z.string().nullish(),
  areaId: z.string().nullish(),
});
export type CreateDiagramDto = z.infer<typeof CreateDiagramSchema>;

// Title/anchor patch only — content is never patched here, only via the
// version-guarded PUT below (mirrors the old AreaImage's update() vs putAnnotations() split).
// previewAttachmentId is the exception: set by the client after it uploads a
// fresh canvas snapshot on save (see diagram-canvas.component.ts#capturePreview).
export const UpdateDiagramSchema = CreateDiagramSchema.partial().extend({
  previewAttachmentId: z.string().nullish(),
});
export type UpdateDiagramDto = z.infer<typeof UpdateDiagramSchema>;

export const DiagramQuerySchema = z.object({
  deviceId: z.string().optional(),
  areaId: z.string().optional(),
  standalone: z.enum(['1', 'true']).optional(),
});
export type DiagramQueryDto = z.infer<typeof DiagramQuerySchema>;

export const PutDiagramContentSchema = z.object({
  version: z.number().int().positive(),
  content: DiagramContentSchema,
});
export type PutDiagramContentDto = z.infer<typeof PutDiagramContentSchema>;
