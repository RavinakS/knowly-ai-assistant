import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isUUID } from 'class-validator';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

export interface StoredUpload {
  id: string;
  filename: string;
  path: string;
}

@Injectable()
export class LocalUploadStorage {
  private readonly logger = new Logger(LocalUploadStorage.name);

  async store(organizationId: string, buffer: Buffer): Promise<StoredUpload> {
    if (!isUUID(organizationId)) {
      throw new InternalServerErrorException('Unable to store uploaded file.');
    }

    const id = randomUUID();
    const root = resolve(process.env.UPLOAD_DIR || 'uploads');
    const directory = resolve(root, organizationId);
    const path = resolve(directory, `${id}.pdf`);
    const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

    if (!directory.startsWith(rootPrefix) || !path.startsWith(rootPrefix)) {
      throw new InternalServerErrorException('Unable to store uploaded file.');
    }

    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(path, buffer, { flag: 'wx', mode: 0o600 });
    } catch {
      await this.removePartialFile(path);
      throw new InternalServerErrorException('Unable to store uploaded file.');
    }

    const filename = `${organizationId}/${id}.pdf`;
    return { id, filename, path };
  }

  async remove(path: string): Promise<void> {
    const root = resolve(process.env.UPLOAD_DIR || 'uploads');
    const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
    const resolvedPath = resolve(path);
    if (!resolvedPath.startsWith(rootPrefix) || isAbsolute(path) === false) {
      throw new InternalServerErrorException('Unable to remove stored file.');
    }

    try {
      await unlink(resolvedPath);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      throw error;
    }
  }

  private async removePartialFile(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      this.logger.error(
        `Failed to remove a partial upload from ${dirname(path)}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
