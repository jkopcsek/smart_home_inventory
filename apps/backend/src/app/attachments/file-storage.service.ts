import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AttachmentKind } from '@smart-home-inventory/shared';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { AppConfig } from '../config/app-config';

/** Extensions we are willing to keep from the original filename. */
const SAFE_EXT = /^[a-z0-9]{1,8}$/;

/** Server-side stored filename: <random>.<sanitized ext>. */
export function generateStoredName(originalName: string): string {
  const rawExt = path.extname(originalName).slice(1).toLowerCase();
  const ext = SAFE_EXT.test(rawExt) ? rawExt : 'bin';
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${rand}.${ext}`;
}

const KIND_MIME_ALLOWLIST: Record<AttachmentKind, RegExp> = {
  manual: /^application\/pdf$/,
  image: /^image\//,
  invoice: /^(application\/pdf|image\/)/,
  diagram: /^(image\/|application\/pdf|text\/)/,
  plan: /^image\//,
  other: /./,
};

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);

  constructor(private readonly config: AppConfig) {}

  get uploadsDir(): string {
    return this.config.uploadsDir;
  }

  validateMime(kind: AttachmentKind, mimeType: string): void {
    if (!KIND_MIME_ALLOWLIST[kind].test(mimeType)) {
      throw new BadRequestException(
        `File type "${mimeType}" is not allowed for kind "${kind}"`
      );
    }
  }

  /** Server-side stored filename: <random>.<sanitized ext>. */
  storedNameFor(originalName: string): string {
    return generateStoredName(originalName);
  }

  absolutePath(storedName: string): string {
    // storedName is server-generated, but stay paranoid about traversal.
    const resolved = path.resolve(this.uploadsDir, storedName);
    if (!resolved.startsWith(this.uploadsDir + path.sep)) {
      throw new BadRequestException('Invalid file name');
    }
    return resolved;
  }

  async sha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve())
        .on('error', reject);
    });
    return hash.digest('hex');
  }

  async deleteQuietly(storedName: string): Promise<void> {
    try {
      await fsp.unlink(this.absolutePath(storedName));
    } catch (err) {
      this.logger.warn(`Could not delete file ${storedName}: ${err}`);
    }
  }
}
