import { Logger, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { HA_REGISTRY_CLIENT } from './ha-registry.types';
import { HaController } from './ha.controller';
import { HaSyncService } from './ha-sync.service';
import { MockHaRegistryClient } from './mock-ha-registry.client';
import { WsHaRegistryClient } from './ws-ha-registry.client';

@Module({
  controllers: [HaController],
  providers: [
    HaSyncService,
    {
      provide: HA_REGISTRY_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const logger = new Logger('HaModule');
        switch (config.haMode) {
          case 'supervisor':
            logger.log(
              `HA registry client: supervisor proxy (read-only: ${config.haReadOnly})`
            );
            return new WsHaRegistryClient(
              'ws://supervisor/core/websocket',
              config.supervisorToken as string,
              config.haReadOnly
            );
          case 'direct': {
            const wsUrl =
              (config.haUrl as string).replace(/^http/, 'ws').replace(/\/$/, '') +
              '/api/websocket';
            logger.log(
              `HA registry client: direct (${wsUrl}, read-only: ${config.haReadOnly})`
            );
            return new WsHaRegistryClient(wsUrl, config.haToken as string, config.haReadOnly);
          }
          default:
            logger.warn(
              'HA registry client: MOCK fixtures (set SUPERVISOR_TOKEN or HA_URL+HA_TOKEN for a real instance)'
            );
            return new MockHaRegistryClient();
        }
      },
    },
  ],
})
export class HaModule {}
