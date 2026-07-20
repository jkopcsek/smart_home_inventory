import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AreaDto,
  AreaQueryDto,
  CreateAreaDto,
  EntitySource,
  UpdateAreaDto,
} from '@smart-home-inventory/shared';
import { Area } from '@smart-home-inventory/prisma';
import { PrismaService } from '../prisma/prisma.service';

type AreaWithCounts = Area & { _count: { devices: number; images: number } };

export function toAreaDto(area: AreaWithCounts): AreaDto {
  return {
    id: area.id,
    name: area.name,
    floor: area.floor,
    notes: area.notes,
    haAreaId: area.haAreaId,
    haOrphaned: area.haOrphaned,
    source: area.source as EntitySource,
    deviceCount: area._count.devices,
    imageCount: area._count.images,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  };
}

const withCounts = { _count: { select: { devices: true, images: true } } } as const;

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AreaQueryDto): Promise<AreaDto[]> {
    const areas = await this.prisma.area.findMany({
      where: {
        ...(query.floor ? { floor: query.floor } : {}),
        ...(query.q ? { name: { contains: query.q } } : {}),
      },
      include: withCounts,
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    });
    return areas.map(toAreaDto);
  }

  async get(id: string): Promise<AreaDto> {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: withCounts,
    });
    if (!area) throw new NotFoundException(`Area ${id} not found`);
    return toAreaDto(area);
  }

  async create(dto: CreateAreaDto): Promise<AreaDto> {
    const area = await this.prisma.area.create({
      data: {
        name: dto.name,
        floor: dto.floor ?? null,
        notes: dto.notes ?? null,
      },
      include: withCounts,
    });
    return toAreaDto(area);
  }

  async update(id: string, dto: UpdateAreaDto): Promise<AreaDto> {
    await this.ensureExists(id);
    const area = await this.prisma.area.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: withCounts,
    });
    return toAreaDto(area);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.area.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.area.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Area ${id} not found`);
  }
}
