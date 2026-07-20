import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AreaQueryDto,
  AreaQuerySchema,
  CreateAreaDto,
  CreateAreaSchema,
  UpdateAreaDto,
  UpdateAreaSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AreasService } from './areas.service';

@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  list(@Query(zodPipe(AreaQuerySchema)) query: AreaQueryDto) {
    return this.areas.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.areas.get(id);
  }

  @Post()
  create(@Body(zodPipe(CreateAreaSchema)) dto: CreateAreaDto) {
    return this.areas.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateAreaSchema)) dto: UpdateAreaDto
  ) {
    return this.areas.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.areas.remove(id);
  }
}
