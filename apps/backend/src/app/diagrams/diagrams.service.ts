import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Diagram } from '@smart-home-inventory/prisma';
import {
  CreateDiagramDto,
  DiagramDto,
  DiagramQueryDto,
  UpdateDiagramDto,
} from '@smart-home-inventory/shared';
import { PrismaService } from '../prisma/prisma.service';

function toDiagramDto(d: Diagram): DiagramDto {
  return {
    id: d.id,
    title: d.title,
    source: d.source,
    deviceId: d.deviceId,
    areaId: d.areaId,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const diagram = await this.prisma.diagram.findUnique({ where: { id } });
    if (!diagram) throw new NotFoundException(`Diagram ${id} not found`);
    return toDiagramDto(diagram);
  }

  async create(dto: CreateDiagramDto): Promise<DiagramDto> {
    await this.validateAnchors(dto.deviceId, dto.areaId);
    const diagram = await this.prisma.diagram.create({
      data: {
        title: dto.title,
        source: dto.source,
        deviceId: dto.deviceId ?? null,
        areaId: dto.areaId ?? null,
      },
    });
    return toDiagramDto(diagram);
  }

  async update(id: string, dto: UpdateDiagramDto): Promise<DiagramDto> {
    await this.get(id);
    if (dto.deviceId !== undefined || dto.areaId !== undefined) {
      await this.validateAnchors(dto.deviceId, dto.areaId);
    }
    const diagram = await this.prisma.diagram.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
      },
    });
    return toDiagramDto(diagram);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.diagram.delete({ where: { id } });
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
