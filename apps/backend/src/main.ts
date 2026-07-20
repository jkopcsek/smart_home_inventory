import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { AppConfig } from './app/config/app-config';

async function bootstrap() {
  // Fail fast on invalid environment before Nest starts wiring modules.
  const config = new AppConfig();
  config.ensureDataDirs();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.log(
    `Smart Home Inventory backend listening on http://localhost:${config.port}/api ` +
      `(data: ${config.dataDir}, ha: ${config.haMode})`
  );
}

bootstrap();
