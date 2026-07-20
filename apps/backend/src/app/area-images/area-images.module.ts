import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppConfig } from '../config/app-config';
import { AttachmentsModule } from '../attachments/attachments.module';
import { generateStoredName } from '../attachments/file-storage.service';
import { AreaImagesController } from './area-images.controller';
import { AreaImagesService } from './area-images.service';

@Module({
  imports: [
    AttachmentsModule,
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        storage: diskStorage({
          destination: config.uploadsDir,
          filename: (_req, file, cb) => cb(null, generateStoredName(file.originalname)),
        }),
        limits: { fileSize: config.uploadMaxBytes },
      }),
    }),
  ],
  controllers: [AreaImagesController],
  providers: [AreaImagesService],
})
export class AreaImagesModule {}
