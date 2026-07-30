import { Module } from '@nestjs/common';
import { ZigbeeCatalogController } from './zigbee-catalog.controller';
import { ZigbeeCatalogService } from './zigbee-catalog.service';

@Module({
  controllers: [ZigbeeCatalogController],
  providers: [ZigbeeCatalogService],
})
export class ZigbeeCatalogModule {}
