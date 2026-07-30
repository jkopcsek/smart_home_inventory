import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { FloorsModule } from './floors/floors.module';
import { AreasModule } from './areas/areas.module';
import { DevicesModule } from './devices/devices.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { ConnectionTypesModule } from './connection-types/connection-types.module';
import { ConnectionsModule } from './connections/connections.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { HaModule } from './ha/ha.module';
import { ZigbeeCatalogModule } from './zigbee-catalog/zigbee-catalog.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    // Serve the built Angular app when STATIC_DIR is set (production add-on);
    // in dev the frontend runs on its own dev server with a proxy.
    ServeStaticModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.staticDir
          ? [
              {
                rootPath: config.staticDir,
                exclude: ['/api{*splat}'],
              },
            ]
          : [],
    }),
    HealthModule,
    FloorsModule,
    AreasModule,
    DevicesModule,
    AttachmentsModule,
    CapabilitiesModule,
    ConnectionTypesModule,
    ConnectionsModule,
    DiagramsModule,
    HaModule,
    ZigbeeCatalogModule,
  ],
})
export class AppModule {}
