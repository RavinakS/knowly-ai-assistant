export interface StoredDocumentFile {
  id: string;
  storageKey: string;
}

export interface StagedDocumentFile {
  originalKey: string;
  stagedKey: string;
}

export interface DocumentStorage {
  store(organizationId: string, buffer: Buffer): Promise<StoredDocumentFile>;
  read(organizationId: string, storageKey: string): Promise<Buffer>;
  remove(organizationId: string, storageKey: string): Promise<void>;

  stageForDeletion(
    organizationId: string,
    storageKey: string,
  ): Promise<StagedDocumentFile | null>;

  restoreStagedFile(file: StagedDocumentFile): Promise<void>;
  removeStagedFile(file: StagedDocumentFile): Promise<void>;
}

export const DOCUMENT_STORAGE = Symbol("DOCUMENT_STORAGE");
