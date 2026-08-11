import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  CapabilityCategory,
  CapabilityTypeDto,
  CreateCapabilityTypeDto,
  DeviceCapabilityDto,
  SetDeviceCapabilityDto,
  UpdateCapabilityTypeDto,
} from '@smart-home-inventory/shared';
import { CapabilityType, Prisma } from '@smart-home-inventory/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { toDeviceCapabilityDto } from '../common/mappers';

/**
 * A device's bare *possibilities* — what it can speak / how it's powered —
 * deliberately not the topology of a specific wire or binding (that's what
 * Connection.type is for). Zigbee and Thread both have a real, commonly-
 * distinguished Router (mains-powered, extends the mesh) vs. End Device
 * (may run on battery, "sleepy") role, so those get their own keys instead
 * of one generic protocol capability; Z-Wave/Matter don't have an
 * equivalently-named distinction worth inventing a term for.
 */
const SYSTEM_CAPABILITIES: Array<{
  key: string;
  label: string;
  category: CapabilityCategory;
}> = [
  { key: 'zigbee_router', label: 'Zigbee Router', category: 'protocol' },
  { key: 'zigbee_end_device', label: 'Zigbee End Device', category: 'protocol' },
  { key: 'zwave', label: 'Z-Wave', category: 'protocol' },
  { key: 'matter', label: 'Matter', category: 'protocol' },
  { key: 'thread_router', label: 'Thread Router', category: 'protocol' },
  { key: 'thread_end_device', label: 'Thread End Device', category: 'protocol' },
  { key: 'knx', label: 'KNX', category: 'protocol' },
  { key: 'homekit', label: 'HomeKit', category: 'protocol' },
  { key: 'wifi', label: 'Wi-Fi', category: 'network' },
  { key: 'ethernet', label: 'Ethernet', category: 'network' },
  { key: 'poe', label: 'PoE', category: 'network' },
  { key: 'cellular', label: 'Cellular', category: 'network' },
  { key: 'bluetooth', label: 'Bluetooth', category: 'protocol' },
  { key: 'mains_230v', label: '230V mains', category: 'power' },
  { key: 'battery', label: 'Battery', category: 'power' },
  { key: 'low_voltage', label: 'Low voltage (12/24V)', category: 'power' },
];

function toCapabilityTypeDto(
  t: CapabilityType & { _count: { devices: number } }
): CapabilityTypeDto {
  return {
    id: t.id,
    key: t.key,
    label: t.label,
    category: t.category as CapabilityCategory,
    isSystem: t.isSystem,
    deviceCount: t._count.devices,
  };
}

const withCount = { _count: { select: { devices: true } } } as const;

@Injectable()
export class CapabilitiesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently seed the built-in capability types on startup, and drop
   *  any system type that's no longer in the list above (e.g. a renamed
   *  key) as long as nothing actually uses it — same "only delete if
   *  unused" rule as removeType below. */
  async onModuleInit(): Promise<void> {
    for (const cap of SYSTEM_CAPABILITIES) {
      await this.prisma.capabilityType.upsert({
        where: { key: cap.key },
        create: { ...cap, isSystem: true },
        update: {},
      });
    }
    const currentKeys = SYSTEM_CAPABILITIES.map((c) => c.key);
    const stale = await this.prisma.capabilityType.findMany({
      where: { isSystem: true, key: { notIn: currentKeys } },
      include: withCount,
    });
    for (const cap of stale) {
      if (cap._count.devices === 0) {
        await this.prisma.capabilityType.delete({ where: { id: cap.id } });
      }
    }
  }

  async listTypes(): Promise<CapabilityTypeDto[]> {
    const types = await this.prisma.capabilityType.findMany({
      include: withCount,
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });
    return types.map(toCapabilityTypeDto);
  }

  async createType(dto: CreateCapabilityTypeDto): Promise<CapabilityTypeDto> {
    const existing = await this.prisma.capabilityType.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new ConflictException(`Capability "${dto.key}" already exists`);
    const type = await this.prisma.capabilityType.create({
      data: { ...dto, isSystem: false },
      include: withCount,
    });
    return toCapabilityTypeDto(type);
  }

  async updateType(id: string, dto: UpdateCapabilityTypeDto): Promise<CapabilityTypeDto> {
    await this.getTypeOrThrow(id);
    const type = await this.prisma.capabilityType.update({
      where: { id },
      data: dto,
      include: withCount,
    });
    return toCapabilityTypeDto(type);
  }

  async removeType(id: string): Promise<void> {
    const type = await this.prisma.capabilityType.findUnique({
      where: { id },
      include: withCount,
    });
    if (!type) throw new NotFoundException(`Capability type ${id} not found`);
    if (type.isSystem) {
      throw new ConflictException('Built-in capability types cannot be deleted');
    }
    if (type._count.devices > 0) {
      throw new ConflictException(
        `Capability "${type.key}" is used by ${type._count.devices} device(s)`
      );
    }
    await this.prisma.capabilityType.delete({ where: { id } });
  }

  async listForDevice(deviceId: string): Promise<DeviceCapabilityDto[]> {
    await this.ensureDevice(deviceId);
    const links = await this.prisma.deviceCapability.findMany({
      where: { deviceId },
      include: { capabilityType: true },
    });
    return links.map(toDeviceCapabilityDto);
  }

  async setForDevice(
    deviceId: string,
    key: string,
    dto: SetDeviceCapabilityDto
  ): Promise<DeviceCapabilityDto> {
    await this.ensureDevice(deviceId);
    const type = await this.prisma.capabilityType.findUnique({ where: { key } });
    if (!type) throw new NotFoundException(`Capability type "${key}" not found`);
    const link = await this.prisma.deviceCapability.upsert({
      where: {
        deviceId_capabilityTypeId: { deviceId, capabilityTypeId: type.id },
      },
      create: {
        deviceId,
        capabilityTypeId: type.id,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        notes: dto.notes ?? null,
      },
      update: {
        ...(dto.metadata !== undefined
          ? { metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { capabilityType: true },
    });
    return toDeviceCapabilityDto(link);
  }

  async removeForDevice(deviceId: string, key: string): Promise<void> {
    await this.ensureDevice(deviceId);
    const type = await this.prisma.capabilityType.findUnique({ where: { key } });
    if (!type) throw new NotFoundException(`Capability type "${key}" not found`);
    await this.prisma.deviceCapability.deleteMany({
      where: { deviceId, capabilityTypeId: type.id },
    });
  }

  private async getTypeOrThrow(id: string): Promise<void> {
    const type = await this.prisma.capabilityType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!type) throw new NotFoundException(`Capability type ${id} not found`);
  }

  private async ensureDevice(deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
  }
}
