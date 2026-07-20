import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentDto,
  UpdateAttachmentDto,
  UploadAttachmentDto,
} from '@smart-home-inventory/shared';
import { Attachment } from '@smart-home-inventory/prisma';
import * as fs from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import { toAttachmentDto } from '../common/mappers';
import { FileStorageService } from './file-storage.service';

export interface UploadedFileInfo {
  /** multer's diskStorage result */
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export type AttachmentOwner =
  | { deviceId: string }
  | { areaId: string };

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService
  ) {}

  async createFromUpload(
    owner: AttachmentOwner,
    file: UploadedFileInfo,
    dto: UploadAttachmentDto
  ): Promise<AttachmentDto> {
    try {
      this.storage.validateMime(dto.kind, file.mimetype);
      await this.ensureOwnerExists(owner);
      const sha256 = await this.storage.sha256(file.path);
      const attachment = await this.prisma.attachment.create({
        data: {
          kind: dto.kind,
          title: dto.title ?? null,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          ...owner,
        },
      });
      return toAttachmentDto(attachment);
    } catch (err) {
      // The file is already on disk (multer diskStorage); don't leak it.
      await this.storage.deleteQuietly(file.filename);
      throw err;
    }
  }

  async get(id: string): Promise<AttachmentDto> {
    return toAttachmentDto(await this.getEntity(id));
  }

  async listForOwner(owner: AttachmentOwner): Promise<AttachmentDto[]> {
    await this.ensureOwnerExists(owner);
    const attachments = await this.prisma.attachment.findMany({
      where: owner,
      orderBy: { createdAt: 'desc' },
    });
    // Plan images are managed through their AreaImage, not the generic list.
    return attachments.filter((a) => a.kind !== 'plan').map(toAttachmentDto);
  }

  async getEntity(id: string): Promise<Attachment> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException(`Attachment ${id} not found`);
    return attachment;
  }

  openStream(attachment: Attachment): fs.ReadStream {
    const filePath = this.storage.absolutePath(attachment.storedName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File is missing on disk');
    }
    return fs.createReadStream(filePath);
  }

  async update(id: string, dto: UpdateAttachmentDto): Promise<AttachmentDto> {
    const existing = await this.getEntity(id);
    if (dto.kind && dto.kind !== existing.kind) {
      this.storage.validateMime(dto.kind, existing.mimeType);
    }
    const attachment = await this.prisma.attachment.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
      },
    });
    return toAttachmentDto(attachment);
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.getEntity(id);
    await this.prisma.attachment.delete({ where: { id } });
    await this.storage.deleteQuietly(attachment.storedName);
  }

  private async ensureOwnerExists(owner: AttachmentOwner): Promise<void> {
    if ('deviceId' in owner) {
      const device = await this.prisma.device.findUnique({
        where: { id: owner.deviceId },
        select: { id: true },
      });
      if (!device) {
        throw new BadRequestException(`Device ${owner.deviceId} does not exist`);
      }
    } else {
      const area = await this.prisma.area.findUnique({
        where: { id: owner.areaId },
        select: { id: true },
      });
      if (!area) {
        throw new BadRequestException(`Area ${owner.areaId} does not exist`);
      }
    }
  }
}
