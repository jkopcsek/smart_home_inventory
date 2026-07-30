import { Module } from '@nestjs/common';
import { ConnectionTypesController } from './connection-types.controller';
import { ConnectionTypesService } from './connection-types.service';

@Module({
  controllers: [ConnectionTypesController],
  providers: [ConnectionTypesService],
  exports: [ConnectionTypesService],
})
export class ConnectionTypesModule {}
