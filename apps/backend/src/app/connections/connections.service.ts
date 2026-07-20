import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@smart-home-inventory/prisma';
import {
  ConnectionDto,
  ConnectionQueryDto,
  CreateConnectionDto,
  UpdateConnectionDto,
} from '@smart-home-inventory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toConnectionDto } from '../common/mappers';

const includeNames = {
  fromDevice: { select: { name: true } },
  toDevice: { select: { name: true } },
} as const;

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ConnectionQueryDto): Promise<ConnectionDto[]> {
    const connections = await this.prisma.connection.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.deviceId
          ? {
              OR: [
                { fromDeviceId: query.deviceId },
                { toDeviceId: query.deviceId },
              ],
            }
          : {}),
        ...(query.areaId
          ? {
              OR: [
                { fromDevice: { areaId: query.areaId } },
                { toDevice: { areaId: query.areaId } },
              ],
            }
          : {}),
      },
      include: includeNames,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
    return connections.map(toConnectionDto);
  }

  async get(id: string): Promise<ConnectionDto> {
    const connection = await this.prisma.connection.findUnique({
      where: { id },
      include: includeNames,
    });
    if (!connection) throw new NotFoundException(`Connection ${id} not found`);
    return toConnectionDto(connection);
  }

  async create(dto: CreateConnectionDto): Promise<ConnectionDto> {
    await this.ensureDevice(dto.fromDeviceId);
    await this.ensureDevice(dto.toDeviceId);
    const connection = await this.prisma.connection.create({
      data: {
        type: dto.type,
        fromDeviceId: dto.fromDeviceId,
        toDeviceId: dto.toDeviceId,
        label: dto.label ?? null,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        notes: dto.notes ?? null,
      },
      include: includeNames,
    });
    return toConnectionDto(connection);
  }

  async update(id: string, dto: UpdateConnectionDto): Promise<ConnectionDto> {
    await this.get(id);
    const connection = await this.prisma.connection.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: includeNames,
    });
    return toConnectionDto(connection);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.connection.delete({ where: { id } });
  }

  private async ensureDevice(deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) {
      throw new BadRequestException(`Device ${deviceId} does not exist`);
    }
  }
}
