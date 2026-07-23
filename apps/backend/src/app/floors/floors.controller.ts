import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateFloorDto,
  CreateFloorSchema,
  UpdateFloorDto,
  UpdateFloorSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { FloorsService } from './floors.service';

@Controller('floors')
export class FloorsController {
  constructor(private readonly floors: FloorsService) {}

  @Get()
  list() {
    return this.floors.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.floors.get(id);
  }

  @Post()
  create(@Body(zodPipe(CreateFloorSchema)) dto: CreateFloorDto) {
    return this.floors.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(zodPipe(UpdateFloorSchema)) dto: UpdateFloorDto) {
    return this.floors.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.floors.remove(id);
  }
}
