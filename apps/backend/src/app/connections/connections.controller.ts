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
  ConnectionQueryDto,
  ConnectionQuerySchema,
  CreateConnectionDto,
  CreateConnectionSchema,
  UpdateConnectionDto,
  UpdateConnectionSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { ConnectionsService } from './connections.service';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@Query(zodPipe(ConnectionQuerySchema)) query: ConnectionQueryDto) {
    return this.connections.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.connections.get(id);
  }

  @Post()
  create(@Body(zodPipe(CreateConnectionSchema)) dto: CreateConnectionDto) {
    return this.connections.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateConnectionSchema)) dto: UpdateConnectionDto
  ) {
    return this.connections.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.connections.remove(id);
  }
}
