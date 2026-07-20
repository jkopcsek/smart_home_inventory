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
  CreateDeviceDto,
  CreateDeviceSchema,
  DeviceQueryDto,
  DeviceQuerySchema,
  SetPrimaryImageDto,
  SetPrimaryImageSchema,
  UpdateDeviceDto,
  UpdateDeviceSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Query(zodPipe(DeviceQuerySchema)) query: DeviceQueryDto) {
    return this.devices.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.devices.get(id);
  }

  @Post()
  create(@Body(zodPipe(CreateDeviceSchema)) dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateDeviceSchema)) dto: UpdateDeviceDto
  ) {
    return this.devices.update(id, dto);
  }

  @Put(':id/primary-image')
  setPrimaryImage(
    @Param('id') id: string,
    @Body(zodPipe(SetPrimaryImageSchema)) dto: SetPrimaryImageDto
  ) {
    return this.devices.setPrimaryImage(id, dto.attachmentId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.devices.remove(id);
  }
}
