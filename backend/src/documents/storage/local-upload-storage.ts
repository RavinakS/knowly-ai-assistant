import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isUUID } from "class-validator";
import { dirname, resolve, sep } from "node:path";
import type {
  DocumentStorage,
  StagedDocumentFile,
  StoredDocumentFile,
} from "./document-storage.interface.js";

@Injectable()
export class LocalUploadStorage implements DocumentStorage {
  private readonly logger = new Logger(LocalUploadStorage.name);

  async store(
    organizationId: string,
    buffer: Buffer,
  ): Promise<StoredDocumentFile> {
    const id = randomUUID();
    const storageKey = `${organizationId}/${id}.pdf`;
    const path = this.resolveStoragePath(organizationId, storageKey);

    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, buffer, { flag: "wx", mode: 0o600 });
    } catch {
      await this.removePartialFile(path);
      throw new InternalServerErrorException("Unable to store uploaded file.");
    }

    return { id, storageKey };
  }

  async read(organizationId: string, storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStoragePath(organizationId, storageKey));
  }

  async remove(organizationId: string, storageKey: string): Promise<void> {
    const path = this.resolveStoragePath(organizationId, storageKey);
    await this.removePath(path);
  }

  async stageForDeletion(
    organizationId: string,
    storageKey: string,
  ): Promise<StagedDocumentFile | null> {
    const originalPath = this.resolveStoragePath(organizationId, storageKey);
    const stagedKey = `${storageKey}.deleting-${randomUUID()}`;
    const stagedPath = this.resolveStoragePath(organizationId, stagedKey, true);

    try {
      await rename(originalPath, stagedPath);
      return { originalKey: storageKey, stagedKey };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async restoreStagedFile(file: StagedDocumentFile): Promise<void> {
    const { originalPath, stagedPath } = this.validateStagedFile(file);
    await rename(stagedPath, originalPath);
  }

  async removeStagedFile(file: StagedDocumentFile): Promise<void> {
    const { stagedPath } = this.validateStagedFile(file);
    await this.removePath(stagedPath);
  }

  private resolveStoragePath(
    organizationId: string,
    storageKey: string,
    allowStaged = false,
  ): string {
    const match =
      /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.pdf(?:\.deleting-([0-9a-f-]{36}))?$/i.exec(
        storageKey,
      );

    if (
      !isUUID(organizationId) ||
      !match ||
      match[1].toLowerCase() !== organizationId.toLowerCase() ||
      !isUUID(match[2]) ||
      (match[3] !== undefined && (!allowStaged || !isUUID(match[3])))
    ) {
      throw new InternalServerErrorException("Invalid stored document key.");
    }

    const root = resolve(process.env.UPLOAD_DIR || "uploads");
    const path = resolve(
      root,
      organizationId,
      `${match[2]}.pdf${match[3] ? `.deleting-${match[3]}` : ""}`,
    );
    const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

    if (!path.startsWith(rootPrefix)) {
      throw new InternalServerErrorException("Invalid stored document key.");
    }

    return path;
  }

  private validateStagedFile(file: StagedDocumentFile): {
    originalPath: string;
    stagedPath: string;
  } {
    const [organizationId] = file.originalKey.split("/");

    if (!file.stagedKey.startsWith(`${file.originalKey}.deleting-`)) {
      throw new InternalServerErrorException("Invalid staged document key.");
    }

    return {
      originalPath: this.resolveStoragePath(organizationId, file.originalKey),
      stagedPath: this.resolveStoragePath(organizationId, file.stagedKey, true),
    };
  }

  private async removePath(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
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
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
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
