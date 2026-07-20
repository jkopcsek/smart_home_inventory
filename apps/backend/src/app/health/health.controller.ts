import { Controller, Get } from '@nestjs/common';
import * as fs from 'node:fs';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig
  ) {}

  @Get()
  async health() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    let dataDirWritable = false;
    try {
      fs.accessSync(this.config.dataDir, fs.constants.W_OK);
      dataDirWritable = true;
    } catch {
      dataDirWritable = false;
    }
    return {
      status: db && dataDirWritable ? 'ok' : 'degraded',
      db,
      dataDirWritable,
      haMode: this.config.haMode,
    };
  }
}
