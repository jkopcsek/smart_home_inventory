import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ZigbeeCatalogService } from './zigbee-catalog.service';

@Controller('zigbee-catalog')
export class ZigbeeCatalogController {
  constructor(private readonly zigbeeCatalog: ZigbeeCatalogService) {}

  @Get('match')
  match(@Query('model') model?: string) {
    if (!model?.trim()) throw new BadRequestException('model query param is required');
    return this.zigbeeCatalog.match(model);
  }
}
