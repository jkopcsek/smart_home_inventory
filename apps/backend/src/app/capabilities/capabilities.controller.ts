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
} from '@nestjs/common';
import {
  CreateCapabilityTypeDto,
  CreateCapabilityTypeSchema,
  SetDeviceCapabilityDto,
  SetDeviceCapabilitySchema,
  UpdateCapabilityTypeDto,
  UpdateCapabilityTypeSchema,
} from '@smart-home-inventory/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CapabilitiesService } from './capabilities.service';

@Controller()
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  @Get('capability-types')
  listTypes() {
    return this.capabilities.listTypes();
  }

  @Post('capability-types')
  createType(
    @Body(zodPipe(CreateCapabilityTypeSchema)) dto: CreateCapabilityTypeDto
  ) {
    return this.capabilities.createType(dto);
  }

  @Patch('capability-types/:id')
  updateType(
    @Param('id') id: string,
    @Body(zodPipe(UpdateCapabilityTypeSchema)) dto: UpdateCapabilityTypeDto
  ) {
    return this.capabilities.updateType(id, dto);
  }

  @Delete('capability-types/:id')
  @HttpCode(204)
  removeType(@Param('id') id: string) {
    return this.capabilities.removeType(id);
  }

  @Get('devices/:deviceId/capabilities')
  listForDevice(@Param('deviceId') deviceId: string) {
    return this.capabilities.listForDevice(deviceId);
  }

  @Put('devices/:deviceId/capabilities/:key')
  setForDevice(
    @Param('deviceId') deviceId: string,
    @Param('key') key: string,
    @Body(zodPipe(SetDeviceCapabilitySchema)) dto: SetDeviceCapabilityDto
  ) {
    return this.capabilities.setForDevice(deviceId, key, dto);
  }

  @Delete('devices/:deviceId/capabilities/:key')
  @HttpCode(204)
  removeForDevice(
    @Param('deviceId') deviceId: string,
    @Param('key') key: string
  ) {
    return this.capabilities.removeForDevice(deviceId, key);
  }
}
