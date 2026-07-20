import { z } from 'zod';
import { AttachmentKind, AttachmentKindSchema } from '../enums';

export interface AttachmentDto {
  id: string;
  kind: AttachmentKind;
  title: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  deviceId: string | null;
  areaId: string | null;
  createdAt: string;
}

export const UploadAttachmentSchema = z.object({
  kind: AttachmentKindSchema.default('other'),
  title: z.string().max(300).nullish(),
});
export type UploadAttachmentDto = z.infer<typeof UploadAttachmentSchema>;

export const UpdateAttachmentSchema = z.object({
  kind: AttachmentKindSchema.optional(),
  title: z.string().max(300).nullish(),
});
export type UpdateAttachmentDto = z.infer<typeof UpdateAttachmentSchema>;
