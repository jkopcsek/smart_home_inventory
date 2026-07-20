import { Controller, Get, Post } from '@nestjs/common';
import { HaSyncService } from './ha-sync.service';

@Controller('ha')
export class HaController {
  constructor(private readonly haSync: HaSyncService) {}

  @Post('sync')
  sync() {
    return this.haSync.sync();
  }

  @Get('status')
  status() {
    return this.haSync.status();
  }
}
