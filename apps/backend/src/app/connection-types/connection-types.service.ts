import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ConnectionTypeDto,
  ConnectionTypeGroup,
  CreateConnectionTypeDto,
  UpdateConnectionTypeDto,
} from '@smart-home-inventory/shared';
import { ConnectionType } from '@smart-home-inventory/prisma';
import { PrismaService } from '../prisma/prisma.service';

const SYSTEM_CONNECTION_TYPES: Array<{
  key: string;
  label: string;
  group: ConnectionTypeGroup;
  color: string;
}> = [
  { key: 'mains_230v', label: '230V mains', group: 'wired', color: '#8b5a2b' },
  { key: 'dc_24v', label: '24V DC', group: 'wired', color: '#c62828' },
  { key: 'dc_12v', label: '12V DC', group: 'wired', color: '#e65100' },
  { key: 'usb', label: 'USB', group: 'wired', color: '#455a64' },
  { key: 'ethernet', label: 'Ethernet', group: 'wired', color: '#1565c0' },
  { key: 'knx', label: 'KNX', group: 'wired', color: '#00897b' },
  { key: 'wifi', label: 'Wi-Fi', group: 'wireless', color: '#6a1b9a' },
  { key: 'zigbee_binding', label: 'Zigbee binding', group: 'wireless', color: '#66bb6a' },
  { key: 'zigbee_network', label: 'Zigbee network', group: 'wireless', color: '#2e7d32' },
  { key: 'zwave_network', label: 'Z-Wave network', group: 'wireless', color: '#4527a0' },
  { key: 'matter_fabric', label: 'Matter fabric', group: 'wireless', color: '#212121' },
  { key: 'thread', label: 'Thread', group: 'wireless', color: '#00838f' },
  { key: 'other', label: 'Other', group: 'other', color: '#757575' },
];

function toConnectionTypeDto(t: ConnectionType, connectionCount: number): ConnectionTypeDto {
  return {
    id: t.id,
    key: t.key,
    label: t.label,
    group: t.group as ConnectionTypeGroup,
    color: t.color,
    isSystem: t.isSystem,
    connectionCount,
  };
}

@Injectable()
export class ConnectionTypesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently seed the built-in connection types on startup, and drop
   *  any system type that's no longer in the list above (e.g. a renamed
   *  key) as long as nothing actually uses it — same "only delete if
   *  unused" rule as removeType below. */
  async onModuleInit(): Promise<void> {
    for (const type of SYSTEM_CONNECTION_TYPES) {
      await this.prisma.connectionType.upsert({
        where: { key: type.key },
        create: { ...type, isSystem: true },
        update: {},
      });
    }
    const currentKeys = new Set(SYSTEM_CONNECTION_TYPES.map((t) => t.key));
    const stale = await this.prisma.connectionType.findMany({
      where: { isSystem: true, key: { notIn: [...currentKeys] } },
    });
    for (const type of stale) {
      const used = await this.prisma.connection.count({ where: { type: type.key } });
      if (used === 0) await this.prisma.connectionType.delete({ where: { id: type.id } });
    }
  }

  async list(): Promise<ConnectionTypeDto[]> {
    const types = await this.prisma.connectionType.findMany({
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });
    return Promise.all(
      types.map(async (t) => toConnectionTypeDto(t, await this.prisma.connection.count({ where: { type: t.key } })))
    );
  }

  async create(dto: CreateConnectionTypeDto): Promise<ConnectionTypeDto> {
    const existing = await this.prisma.connectionType.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Connection type "${dto.key}" already exists`);
    const type = await this.prisma.connectionType.create({ data: { ...dto, isSystem: false } });
    return toConnectionTypeDto(type, 0);
  }

  async update(id: string, dto: UpdateConnectionTypeDto): Promise<ConnectionTypeDto> {
    const type = await this.getOrThrow(id);
    const updated = await this.prisma.connectionType.update({ where: { id }, data: dto });
    return toConnectionTypeDto(updated, await this.prisma.connection.count({ where: { type: type.key } }));
  }

  async remove(id: string): Promise<void> {
    const type = await this.getOrThrow(id);
    if (type.isSystem) throw new ConflictException('Built-in connection types cannot be deleted');
    const used = await this.prisma.connection.count({ where: { type: type.key } });
    if (used > 0) {
      throw new ConflictException(`Connection type "${type.key}" is used by ${used} connection(s)`);
    }
    await this.prisma.connectionType.delete({ where: { id } });
  }

  /** Used by ConnectionsService to validate a Connection's `type` — it's a
   *  plain string, not a foreign key (see the schema comment on the
   *  ConnectionType model), so this is the only thing standing between a
   *  typo and a silently-orphaned connection. */
  async ensureKeyExists(key: string): Promise<void> {
    const type = await this.prisma.connectionType.findUnique({ where: { key }, select: { id: true } });
    if (!type) throw new NotFoundException(`Connection type "${key}" not found`);
  }

  private async getOrThrow(id: string): Promise<ConnectionType> {
    const type = await this.prisma.connectionType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`Connection type ${id} not found`);
    return type;
  }
}
