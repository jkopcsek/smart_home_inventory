import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { DiagramsController } from './diagrams.controller';
import { DiagramsService } from './diagrams.service';

@Module({
  imports: [AttachmentsModule],
  controllers: [DiagramsController],
  providers: [DiagramsService],
})
export class DiagramsModule {}
