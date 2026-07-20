import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HaStatusDto, SyncResultDto } from '@smart-home-inventory/shared';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { HA_REGISTRY_CLIENT, HaRegistryClient } from './ha-registry.types';
import { mergeRegistry } from './ha-sync.merge';

@Injectable()
export class HaSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HaSyncService.name);
  private lastSyncAt: Date | null = null;
  private lastSyncResult: SyncResultDto | null = null;
  private syncRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    @Inject(HA_REGISTRY_CLIENT) private readonly client: HaRegistryClient
  ) {}

  onModuleInit(): void {
    if (this.config.haSyncIntervalMinutes > 0) {
      this.interval = setInterval(
        () =>
          this.sync().catch((err) =>
            this.logger.warn(`Periodic HA sync failed: ${err.message}`)
          ),
        this.config.haSyncIntervalMinutes * 60 * 1000
      );
      this.interval.unref();
    }
    if (this.config.haMode === 'supervisor') {
      // One startup sync attempt in the add-on; failures are non-fatal.
      this.sync().catch((err) =>
        this.logger.warn(`Startup HA sync failed: ${err.message}`)
      );
    }
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async status(): Promise<HaStatusDto> {
    return {
      mode: this.config.haMode,
      connected: await this.client.ping(),
      readOnly: this.config.haReadOnly,
      lastSyncAt: this.lastSyncAt?.toISOString() ?? null,
      lastSyncResult: this.lastSyncResult,
    };
  }

  async sync(): Promise<SyncResultDto> {
    if (this.syncRunning) {
      throw new ServiceUnavailableException('A sync is already running');
    }
    this.syncRunning = true;
    try {
      return await this.doSync();
    } finally {
      this.syncRunning = false;
    }
  }

  private async doSync(): Promise<SyncResultDto> {
    const [remoteAreas, remoteDevices] = await Promise.all([
      this.client.listAreas(),
      this.client.listDevices(),
    ]);

    const result = await this.prisma.$transaction(async (tx) => {
      const localAreas = await tx.area.findMany({
        select: { id: true, name: true, haAreaId: true, haName: true, haOrphaned: true },
      });
      const localDevices = await tx.device.findMany({
        select: {
          id: true,
          name: true,
          manufacturer: true,
          model: true,
          areaId: true,
          haDeviceId: true,
          haName: true,
          haAreaIdAtSync: true,
          haOrphaned: true,
        },
      });

      const merge = mergeRegistry(
        { areas: localAreas, devices: localDevices },
        { areas: remoteAreas, devices: remoteDevices }
      );

      for (const op of merge.areaCreates) {
        await tx.area.create({
          data: {
            name: op.name,
            haAreaId: op.haAreaId,
            haName: op.name,
            source: 'ha',
          },
        });
      }
      for (const op of merge.areaUpdates) {
        await tx.area.update({ where: { id: op.id }, data: op.data });
      }

      // Resolve HA area ids to local area ids (including freshly created ones).
      const areasNow = await tx.area.findMany({
        where: { haAreaId: { not: null } },
        select: { id: true, haAreaId: true },
      });
      const areaIdByHaId = new Map(areasNow.map((a) => [a.haAreaId as string, a.id]));
      const resolveArea = (haAreaRef: string | null): string | null =>
        haAreaRef ? areaIdByHaId.get(haAreaRef) ?? null : null;

      for (const op of merge.deviceCreates) {
        await tx.device.create({
          data: {
            name: op.name,
            manufacturer: op.manufacturer,
            model: op.model,
            haDeviceId: op.haDeviceId,
            haName: op.name,
            haAreaIdAtSync: op.haAreaRef,
            areaId: resolveArea(op.haAreaRef),
            source: 'ha',
          },
        });
      }
      for (const op of merge.deviceUpdates) {
        await tx.device.update({
          where: { id: op.id },
          data: {
            ...op.data,
            ...(op.haAreaRef !== undefined
              ? { areaId: resolveArea(op.haAreaRef) }
              : {}),
          },
        });
      }

      const areaUpdated = merge.areaUpdates.filter((u) => !u.data.haOrphaned).length;
      const areaOrphaned = merge.areaUpdates.filter((u) => u.data.haOrphaned).length;
      const deviceUpdated = merge.deviceUpdates.filter((u) => !u.data.haOrphaned).length;
      const deviceOrphaned = merge.deviceUpdates.filter((u) => u.data.haOrphaned).length;

      const syncResult: SyncResultDto = {
        areas: {
          created: merge.areaCreates.length,
          updated: areaUpdated,
          orphaned: areaOrphaned,
          unchanged: remoteAreas.length - merge.areaCreates.length - areaUpdated,
        },
        devices: {
          created: merge.deviceCreates.length,
          updated: deviceUpdated,
          orphaned: deviceOrphaned,
          unchanged:
            remoteDevices.filter((d) => d.entry_type !== 'service').length -
            merge.deviceCreates.length -
            deviceUpdated,
        },
        warnings: merge.warnings,
        syncedAt: new Date().toISOString(),
      };
      return syncResult;
    });

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;
    this.logger.log(
      `HA sync done: areas +${result.areas.created}/~${result.areas.updated}, ` +
        `devices +${result.devices.created}/~${result.devices.updated}`
    );
    return result;
  }
}
