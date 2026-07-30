import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  CreateConnectionTypeDto,
  CreateConnectionTypeSchema,
  UpdateConnectionTypeDto,
  UpdateConnectionTypeSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { ConnectionTypesService } from './connection-types.service';

@Controller('connection-types')
export class ConnectionTypesController {
  constructor(private readonly connectionTypes: ConnectionTypesService) {}

  @Get()
  list() {
    return this.connectionTypes.list();
  }

  @Post()
  create(@Body(zodPipe(CreateConnectionTypeSchema)) dto: CreateConnectionTypeDto) {
    return this.connectionTypes.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateConnectionTypeSchema)) dto: UpdateConnectionTypeDto
  ) {
    return this.connectionTypes.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.connectionTypes.remove(id);
  }
}
