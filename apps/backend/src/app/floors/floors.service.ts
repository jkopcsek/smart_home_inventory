import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFloorDto, EntitySource, FloorDto, UpdateFloorDto } from '@smart-home-inventory/shared';
import { Floor } from '@smart-home-inventory/prisma';
import { PrismaService } from '../prisma/prisma.service';

type FloorWithCounts = Floor & { _count: { areas: number } };

export function toFloorDto(floor: FloorWithCounts): FloorDto {
  return {
    id: floor.id,
    name: floor.name,
    level: floor.level,
    haFloorId: floor.haFloorId,
    haOrphaned: floor.haOrphaned,
    source: floor.source as EntitySource,
    areaCount: floor._count.areas,
    createdAt: floor.createdAt.toISOString(),
    updatedAt: floor.updatedAt.toISOString(),
  };
}

const withCounts = { _count: { select: { areas: true } } } as const;

@Injectable()
export class FloorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<FloorDto[]> {
    const floors = await this.prisma.floor.findMany({
      include: withCounts,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    return floors.map(toFloorDto);
  }

  async get(id: string): Promise<FloorDto> {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: withCounts,
    });
    if (!floor) throw new NotFoundException(`Floor ${id} not found`);
    return toFloorDto(floor);
  }

  async create(dto: CreateFloorDto): Promise<FloorDto> {
    const floor = await this.prisma.floor.create({
      data: {
        name: dto.name,
        level: dto.level ?? null,
      },
      include: withCounts,
    });
    return toFloorDto(floor);
  }

  async update(id: string, dto: UpdateFloorDto): Promise<FloorDto> {
    await this.ensureExists(id);
    const floor = await this.prisma.floor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
      },
      include: withCounts,
    });
    return toFloorDto(floor);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.floor.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.floor.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Floor ${id} not found`);
  }
}
