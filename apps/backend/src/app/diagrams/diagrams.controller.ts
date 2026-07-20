import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CreateDiagramDto,
  CreateDiagramSchema,
  DiagramQueryDto,
  DiagramQuerySchema,
  PutDiagramContentDto,
  PutDiagramContentSchema,
  UpdateDiagramDto,
  UpdateDiagramSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { DiagramsService } from './diagrams.service';

@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagrams: DiagramsService) {}

  @Get()
  list(@Query(zodPipe(DiagramQuerySchema)) query: DiagramQueryDto) {
    return this.diagrams.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.diagrams.get(id);
  }

  @Post()
  create(@Body(zodPipe(CreateDiagramSchema)) dto: CreateDiagramDto) {
    return this.diagrams.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateDiagramSchema)) dto: UpdateDiagramDto
  ) {
    return this.diagrams.update(id, dto);
  }

  @Put(':id/content')
  putContent(
    @Param('id') id: string,
    @Body(zodPipe(PutDiagramContentSchema)) dto: PutDiagramContentDto
  ) {
    return this.diagrams.putContent(id, dto.version, dto.content);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.diagrams.remove(id);
  }
}
