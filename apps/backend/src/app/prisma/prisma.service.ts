import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@smart-home-inventory/prisma';
import { AppConfig } from '../config/app-config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
