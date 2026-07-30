import { Module } from '@nestjs/common';
import { ConnectionTypesModule } from '../connection-types/connection-types.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [ConnectionTypesModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
