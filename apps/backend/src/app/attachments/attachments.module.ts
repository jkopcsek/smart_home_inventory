import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppConfig } from '../config/app-config';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { FileStorageService, generateStoredName } from './file-storage.service';

@Module({
  imports: [
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
  controllers: [AttachmentsController],
  providers: [AttachmentsService, FileStorageService],
  exports: [AttachmentsService, FileStorageService],
})
export class AttachmentsModule {}
