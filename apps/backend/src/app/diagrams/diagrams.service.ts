import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Diagram, Prisma } from '@smart-home-inventory/prisma';
import {
  CreateDiagramDto,
  DiagramContent,
  DiagramContentSchema,
  DiagramDto,
  DiagramQueryDto,
  EMPTY_DIAGRAM_CONTENT,
  UpdateDiagramDto,
} from '@smart-home-inventory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';

const logger = new Logger('DiagramsService');

function toDiagramDto(d: Diagram): DiagramDto {
  const parsed = DiagramContentSchema.safeParse(d.content);
  if (!parsed.success) {
    logger.warn(`Diagram ${d.id} has content that no longer matches the schema; showing empty`);
  }
  return {
    id: d.id,
    title: d.title,
    content: parsed.success ? parsed.data : EMPTY_DIAGRAM_CONTENT,
    version: d.version,
    deviceId: d.deviceId,
    areaId: d.areaId,
    previewAttachmentId: d.previewAttachmentId,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

@Injectable()
export class DiagramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService
  ) {}

  async list(query: DiagramQueryDto): Promise<DiagramDto[]> {
    const diagrams = await this.prisma.diagram.findMany({
      where: {
        ...(query.deviceId ? { deviceId: query.deviceId } : {}),
        ...(query.areaId ? { areaId: query.areaId } : {}),
        ...(query.standalone ? { deviceId: null, areaId: null } : {}),
      },
      orderBy: { title: 'asc' },
    });
    return diagrams.map(toDiagramDto);
  }

  async get(id: string): Promise<DiagramDto> {
    return toDiagramDto(await this.getEntity(id));
  }

  async create(dto: CreateDiagramDto): Promise<DiagramDto> {
    await this.validateAnchors(dto.deviceId, dto.areaId);
    const diagram = await this.prisma.diagram.create({
      data: {
        title: dto.title,
        deviceId: dto.deviceId ?? null,
        areaId: dto.areaId ?? null,
        content: EMPTY_DIAGRAM_CONTENT as unknown as Prisma.InputJsonValue,
      },
    });
    return toDiagramDto(diagram);
  }

  async update(id: string, dto: UpdateDiagramDto): Promise<DiagramDto> {
    const existing = await this.getEntity(id);
    if (dto.deviceId !== undefined || dto.areaId !== undefined) {
      await this.validateAnchors(dto.deviceId, dto.areaId);
    }
    const diagram = await this.prisma.diagram.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
        ...(dto.previewAttachmentId !== undefined
          ? { previewAttachmentId: dto.previewAttachmentId }
          : {}),
      },
    });
    // The old preview is a generated artifact with no gallery of its own —
    // clean it up rather than leaving an orphaned, unreachable file behind.
    if (
      dto.previewAttachmentId !== undefined &&
      existing.previewAttachmentId &&
      existing.previewAttachmentId !== dto.previewAttachmentId
    ) {
      await this.attachments.remove(existing.previewAttachmentId).catch((err) => {
        logger.warn(`Failed to remove old preview attachment ${existing.previewAttachmentId}: ${err}`);
      });
    }
    return toDiagramDto(diagram);
  }

  async putContent(
    id: string,
    version: number,
    content: DiagramContent
  ): Promise<DiagramDto> {
    const existing = await this.getEntity(id);
    if (existing.version !== version) {
      throw new ConflictException(
        `Diagram version conflict: expected ${existing.version}, got ${version}`
      );
    }
    const diagram = await this.prisma.diagram.update({
      where: { id },
      data: {
        content: content as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    return toDiagramDto(diagram);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getEntity(id);
    await this.prisma.diagram.delete({ where: { id } });
    // Same cleanup as update()'s preview replacement — the preview is a
    // generated artifact with no gallery of its own, so it'd otherwise be
    // orphaned (DB row and file on disk) once its owning diagram is gone.
    if (existing.previewAttachmentId) {
      await this.attachments.remove(existing.previewAttachmentId).catch((err) => {
        logger.warn(
          `Failed to remove preview attachment ${existing.previewAttachmentId} for deleted diagram ${id}: ${err}`
        );
      });
    }
  }

  private async getEntity(id: string): Promise<Diagram> {
    const diagram = await this.prisma.diagram.findUnique({ where: { id } });
    if (!diagram) throw new NotFoundException(`Diagram ${id} not found`);
    return diagram;
  }

  private async validateAnchors(
    deviceId: string | null | undefined,
    areaId: string | null | undefined
  ): Promise<void> {
    if (deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true },
      });
      if (!device) throw new BadRequestException(`Device ${deviceId} does not exist`);
    }
    if (areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: areaId },
        select: { id: true },
      });
      if (!area) throw new BadRequestException(`Area ${areaId} does not exist`);
    }
  }
}
