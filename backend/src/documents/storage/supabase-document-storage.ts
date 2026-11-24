import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isUUID } from "class-validator";
import { randomUUID } from "node:crypto";
import type {
  DocumentStorage,
  StagedDocumentFile,
  StoredDocumentFile,
} from "./document-storage.interface.js";

interface SupabaseStorageError {
  message: string;
  statusCode?: string;
}

@Injectable()
export class SupabaseDocumentStorage implements DocumentStorage {
  private readonly logger = new Logger(SupabaseDocumentStorage.name);
  private readonly client: SupabaseClient;
  private readonly bucketName: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "";

    if (!url || !secretKey || !this.bucketName) {
      throw new Error(
        "SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_STORAGE_BUCKET are required when STORAGE_PROVIDER=supabase.",
      );
    }

    this.client = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async store(
    organizationId: string,
    buffer: Buffer,
  ): Promise<StoredDocumentFile> {
    const id = randomUUID();
    const storageKey = `${organizationId}/${id}.pdf`;
    this.validateDocumentKey(organizationId, storageKey);

    const { error } = await this.bucket.upload(storageKey, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) {
      this.throwStorageError("upload", error);
    }

    return { id, storageKey };
  }

  async read(organizationId: string, storageKey: string): Promise<Buffer> {
    this.validateDocumentKey(organizationId, storageKey);

    const { data, error } = await this.bucket.download(storageKey);
    if (error) {
      this.throwStorageError("read", error);
    }
    if (!data) {
      throw new InternalServerErrorException(
        "Unable to read the stored document.",
      );
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async remove(organizationId: string, storageKey: string): Promise<void> {
    this.validateDocumentKey(organizationId, storageKey);

    const { error } = await this.bucket.remove([storageKey]);
    if (error) {
      this.throwStorageError("remove", error);
    }
  }

  async stageForDeletion(
    organizationId: string,
    storageKey: string,
  ): Promise<StagedDocumentFile | null> {
    this.validateDocumentKey(organizationId, storageKey);

    const stagedKey = `${storageKey}.deleting-${randomUUID()}`;
    this.validateDocumentKey(organizationId, stagedKey, true);

    const { error } = await this.bucket.move(storageKey, stagedKey);
    if (error) {
      if (error.statusCode === "404") {
        return null;
      }
      this.throwStorageError("stage for deletion", error);
    }

    return { originalKey: storageKey, stagedKey };
  }

  async restoreStagedFile(file: StagedDocumentFile): Promise<void> {
    this.validateStagedFile(file);

    const { error } = await this.bucket.move(file.stagedKey, file.originalKey);
    if (error) {
      this.throwStorageError("restore", error);
    }
  }

  async removeStagedFile(file: StagedDocumentFile): Promise<void> {
    const organizationId = this.validateStagedFile(file);
    this.validateDocumentKey(organizationId, file.stagedKey, true);

    const { error } = await this.bucket.remove([file.stagedKey]);
    if (error) {
      this.throwStorageError("remove staged file", error);
    }
  }

  private get bucket() {
    return this.client.storage.from(this.bucketName);
  }

  private validateDocumentKey(
    organizationId: string,
    storageKey: string,
    allowStaged = false,
  ): void {
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
  }

  private validateStagedFile(file: StagedDocumentFile): string {
    const [organizationId] = file.originalKey.split("/");

    if (!file.stagedKey.startsWith(`${file.originalKey}.deleting-`)) {
      throw new InternalServerErrorException("Invalid staged document key.");
    }

    this.validateDocumentKey(organizationId, file.originalKey);
    this.validateDocumentKey(organizationId, file.stagedKey, true);
    return organizationId;
  }

  private throwStorageError(
    operation: string,
    error: SupabaseStorageError,
  ): never {
    this.logger.error(
      `Supabase Storage ${operation} failed (${error.statusCode ?? "unknown"}): ${error.message}`,
    );
    throw new InternalServerErrorException(
      `Unable to ${operation} the document in storage.`,
    );
  }
}
