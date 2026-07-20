import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AreaImage, Prisma } from '@smart-home-inventory/prisma';
import {
  AreaImageDto,
  AreaImageKind,
  CreateAreaImageDto,
  EMPTY_ANNOTATIONS,
  PlanAnnotations,
  PlanAnnotationsSchema,
  UpdateAreaImageDto,
} from '@smart-home-inventory/shared';
import imageSize from 'image-size';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService, UploadedFileInfo } from '../attachments/attachments.service';
import { FileStorageService } from '../attachments/file-storage.service';

function toAreaImageDto(img: AreaImage): AreaImageDto {
  const parsed = PlanAnnotationsSchema.safeParse(img.annotations);
  return {
    id: img.id,
    areaId: img.areaId,
    name: img.name,
    kind: (img.kind as AreaImageKind | null) ?? null,
    description: img.description,
    imageAttachmentId: img.imageAttachmentId,
    imageWidth: img.imageWidth,
    imageHeight: img.imageHeight,
    annotations: parsed.success ? parsed.data : EMPTY_ANNOTATIONS,
    version: img.version,
    createdAt: img.createdAt.toISOString(),
    updatedAt: img.updatedAt.toISOString(),
  };
}

@Injectable()
export class AreaImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly storage: FileStorageService
  ) {}

  async listForArea(areaId: string): Promise<AreaImageDto[]> {
    await this.ensureArea(areaId);
    const images = await this.prisma.areaImage.findMany({
      where: { areaId },
      orderBy: { createdAt: 'asc' },
    });
    return images.map(toAreaImageDto);
  }

  async get(id: string): Promise<AreaImageDto> {
    return toAreaImageDto(await this.getEntity(id));
  }

  async create(
    areaId: string,
    dto: CreateAreaImageDto,
    file: UploadedFileInfo | undefined
  ): Promise<AreaImageDto> {
    await this.ensureArea(areaId);
    let attachmentId: string | null = null;
    let dims: { width: number; height: number } | null = null;
    if (file) {
      const attachment = await this.attachments.createFromUpload(
        { areaId },
        file,
        { kind: 'plan', title: dto.name }
      );
      attachmentId = attachment.id;
      dims = this.probeDimensions(attachment.id, file.filename);
    }
    const image = await this.prisma.areaImage.create({
      data: {
        areaId,
        name: dto.name,
        kind: dto.kind ?? null,
        description: dto.description ?? null,
        imageAttachmentId: attachmentId,
        imageWidth: dims?.width ?? null,
        imageHeight: dims?.height ?? null,
        annotations: EMPTY_ANNOTATIONS as unknown as Prisma.InputJsonValue,
      },
    });
    return toAreaImageDto(image);
  }

  async update(id: string, dto: UpdateAreaImageDto): Promise<AreaImageDto> {
    await this.getEntity(id);
    const image = await this.prisma.areaImage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    return toAreaImageDto(image);
  }

  /** Replace (or set) the underlying image; annotations are kept. */
  async replaceImage(id: string, file: UploadedFileInfo): Promise<AreaImageDto> {
    const existing = await this.getEntity(id);
    const attachment = await this.attachments.createFromUpload(
      { areaId: existing.areaId },
      file,
      { kind: 'plan', title: existing.name }
    );
    const dims = this.probeDimensions(attachment.id, file.filename);
    const image = await this.prisma.areaImage.update({
      where: { id },
      data: {
        imageAttachmentId: attachment.id,
        imageWidth: dims?.width ?? null,
        imageHeight: dims?.height ?? null,
      },
    });
    // Remove the old file after the new one is linked.
    if (existing.imageAttachmentId) {
      await this.attachments.remove(existing.imageAttachmentId).catch(() => undefined);
    }
    return toAreaImageDto(image);
  }

  async putAnnotations(
    id: string,
    version: number,
    annotations: PlanAnnotations
  ): Promise<AreaImageDto> {
    const existing = await this.getEntity(id);
    if (existing.version !== version) {
      throw new ConflictException(
        `Annotation version conflict: expected ${existing.version}, got ${version}`
      );
    }
    const image = await this.prisma.areaImage.update({
      where: { id },
      data: {
        annotations: annotations as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    return toAreaImageDto(image);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getEntity(id);
    await this.prisma.areaImage.delete({ where: { id } });
    if (existing.imageAttachmentId) {
      await this.attachments.remove(existing.imageAttachmentId).catch(() => undefined);
    }
  }

  private probeDimensions(
    attachmentId: string,
    storedName: string
  ): { width: number; height: number } | null {
    try {
      const size = imageSize(this.storage.absolutePath(storedName));
      if (size.width && size.height) {
        return { width: size.width, height: size.height };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async getEntity(id: string): Promise<AreaImage> {
    const image = await this.prisma.areaImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException(`Area image ${id} not found`);
    return image;
  }

  private async ensureArea(areaId: string): Promise<void> {
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true },
    });
    if (!area) throw new BadRequestException(`Area ${areaId} does not exist`);
  }
}
