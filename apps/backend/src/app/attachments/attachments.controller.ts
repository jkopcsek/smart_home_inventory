import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  UpdateAttachmentDto,
  UpdateAttachmentSchema,
  UploadAttachmentDto,
  UploadAttachmentSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AttachmentsService, UploadedFileInfo } from './attachments.service';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('devices/:deviceId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadForDevice(
    @Param('deviceId') deviceId: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body(zodPipe(UploadAttachmentSchema)) dto: UploadAttachmentDto
  ) {
    if (!file) throw new BadRequestException('file field is required');
    return this.attachments.createFromUpload({ deviceId }, file, dto);
  }

  @Post('areas/:areaId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadForArea(
    @Param('areaId') areaId: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body(zodPipe(UploadAttachmentSchema)) dto: UploadAttachmentDto
  ) {
    if (!file) throw new BadRequestException('file field is required');
    return this.attachments.createFromUpload({ areaId }, file, dto);
  }

  @Get('devices/:deviceId/attachments')
  listForDevice(@Param('deviceId') deviceId: string) {
    return this.attachments.listForOwner({ deviceId });
  }

  @Get('areas/:areaId/attachments')
  listForArea(@Param('areaId') areaId: string) {
    return this.attachments.listForOwner({ areaId });
  }

  @Post('home/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadForHome(
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body(zodPipe(UploadAttachmentSchema)) dto: UploadAttachmentDto
  ) {
    if (!file) throw new BadRequestException('file field is required');
    return this.attachments.createFromUpload({ home: true }, file, dto);
  }

  @Get('home/attachments')
  listForHome() {
    return this.attachments.listForOwner({ home: true });
  }

  @Get('attachments/:id')
  get(@Param('id') id: string) {
    return this.attachments.get(id);
  }

  @Get('attachments/:id/download')
  async download(
    @Param('id') id: string,
    @Query('inline') inline?: string
  ): Promise<StreamableFile> {
    const attachment = await this.attachments.getEntity(id);
    const stream = this.attachments.openStream(attachment);
    const disposition = inline === '1' || inline === 'true' ? 'inline' : 'attachment';
    const safeName = encodeURIComponent(attachment.originalName);
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      length: attachment.sizeBytes,
      disposition: `${disposition}; filename*=UTF-8''${safeName}`,
    });
  }

  @Patch('attachments/:id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateAttachmentSchema)) dto: UpdateAttachmentDto
  ) {
    return this.attachments.update(id, dto);
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.attachments.remove(id);
  }
}
