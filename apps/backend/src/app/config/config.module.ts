import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => {
        const config = new AppConfig();
        config.ensureDataDirs();
        return config;
      },
    },
  ],
  exports: [AppConfig],
})
export class AppConfigModule {}
