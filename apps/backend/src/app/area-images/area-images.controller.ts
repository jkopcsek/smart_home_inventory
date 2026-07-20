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
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateAreaImageDto,
  CreateAreaImageSchema,
  PutAnnotationsDto,
  PutAnnotationsSchema,
  UpdateAreaImageDto,
  UpdateAreaImageSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { UploadedFileInfo } from '../attachments/attachments.service';
import { AreaImagesService } from './area-images.service';

@Controller()
export class AreaImagesController {
  constructor(private readonly areaImages: AreaImagesService) {}

  @Get('areas/:areaId/images')
  listForArea(@Param('areaId') areaId: string) {
    return this.areaImages.listForArea(areaId);
  }

  @Post('areas/:areaId/images')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Param('areaId') areaId: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body(zodPipe(CreateAreaImageSchema)) dto: CreateAreaImageDto
  ) {
    return this.areaImages.create(areaId, dto, file);
  }

  @Get('area-images/:id')
  get(@Param('id') id: string) {
    return this.areaImages.get(id);
  }

  @Patch('area-images/:id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateAreaImageSchema)) dto: UpdateAreaImageDto
  ) {
    return this.areaImages.update(id, dto);
  }

  @Put('area-images/:id/image')
  @UseInterceptors(FileInterceptor('file'))
  replaceImage(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileInfo | undefined
  ) {
    if (!file) throw new BadRequestException('file field is required');
    return this.areaImages.replaceImage(id, file);
  }

  @Put('area-images/:id/annotations')
  putAnnotations(
    @Param('id') id: string,
    @Body(zodPipe(PutAnnotationsSchema)) dto: PutAnnotationsDto
  ) {
    return this.areaImages.putAnnotations(id, dto.version, dto.annotations);
  }

  @Delete('area-images/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.areaImages.remove(id);
  }
}
