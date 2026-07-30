import { Controller, Get, Post, Query } from '@nestjs/common';
import { HaCapabilitySuggestionsService } from './ha-capability-suggestions.service';
import { HaSyncService } from './ha-sync.service';

@Controller('ha')
export class HaController {
  constructor(
    private readonly haSync: HaSyncService,
    private readonly haCapabilitySuggestions: HaCapabilitySuggestionsService
  ) {}

  @Post('sync')
  sync() {
    return this.haSync.sync();
  }

  @Get('status')
  status() {
    return this.haSync.status();
  }

  @Get('capability-suggestions')
  capabilitySuggestions(@Query('deviceId') deviceId?: string) {
    if (!deviceId?.trim()) return null;
    return this.haCapabilitySuggestions.forDevice(deviceId);
  }
}
