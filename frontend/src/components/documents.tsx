import { useState, useEffect, useRef, ChangeEvent } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";
import { useRouter } from "next/navigation";

interface OrganizationDocument {
  id: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number | null;
  mimeType: string;
  status: "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDocument(value: unknown): value is OrganizationDocument {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.originalFilename === "string" &&
    typeof value.fileSize === "number" &&
    (typeof value.pageCount === "number" || value.pageCount === null) &&
    typeof value.mimeType === "string" &&
    (value.status === "PROCESSING" ||
      value.status === "READY" ||
      value.status === "FAILED") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCUMENT_HEADER = [
  "File Name",
  "Upload Date",
  "Processing Status",
  "Page Count",
];

export function Documents() {
  const router = useRouter();
  const [documents, setDocuments] = useState<OrganizationDocument[] | null>(
    null,
  );
  const [documentsError, setDocumentsError] = useState<string | null>(
    apiBaseUrl ? null : "Set NEXT_PUBLIC_API_URL to connect to the Knowly API.",
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentsRefresh, setDocumentsRefresh] = useState(0);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const controller = new AbortController();

    async function fetchDocuments() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/organization/me/documents`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          const message = await responseErrorMessage(
            response,
            "Unable to load your knowledge base.",
          );

          if (!controller.signal.aborted) {
            setDocumentsError(message);
          }
          return;
        }

        const result: unknown = await response.json();

        if (Array.isArray(result) && result.every(isDocument)) {
          console.log("documents: ", result);

          if (!controller.signal.aborted) {
            setDocuments(result);
            setDocumentsError("");
          }
        } else if (!controller.signal.aborted) {
          setDocumentsError(
            "The API returned an unexpected documents response.",
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (controller.signal.aborted) {
          setDocumentsError("Could not reach the Knowly API.");
        }

        return;
      }
    }

    void fetchDocuments();
    return () => controller.abort();
  }, [documentsRefresh, router]);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setUploadError(null);
    setUploadMessage(null);
    if (!file) {
      return;
    }
    if (file.size === 0) {
      setUploadError("The selected file is empty.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      return;
    }
    if (!apiBaseUrl) {
      setUploadError("Set NEXT_PUBLIC_API_URL to connect to the Knowly API.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setUploadError(
          await responseErrorMessage(response, "Unable to upload this PDF."),
        );
        return;
      }
      const uploaded: unknown = await response.json();
      if (isRecord(uploaded) && uploaded.status === "FAILED") {
        setUploadError(
          "The PDF was uploaded, but text extraction failed. The original file was retained.",
        );
        setDocumentsRefresh((current) => current + 1);
        return;
      }
      setUploadMessage(
        isRecord(uploaded) && uploaded.status === "READY"
          ? "Upload successful. PDF text is ready."
          : "Upload successful",
      );
      setDocumentsRefresh((current) => current + 1);
    } catch {
      setUploadError(
        "Could not reach the Knowly API. Check that the backend is running.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-[#e4e7df] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Knowledge base</h2>
            <p className="mt-1 text-sm text-[#858a81]">
              Your organization&apos;s reference documents
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-lg bg-[#283d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#354d3e] disabled:cursor-wait disabled:opacity-60"
          >
            {isUploading ? "Uploading..." : "Upload PDF"}
          </button>
        </div>
        {uploadError && (
          <p role="alert" className="mt-4 text-sm text-[#9d4237]">
            {uploadError}
          </p>
        )}
        {uploadMessage && (
          <p role="status" className="mt-4 text-sm text-[#526a54]">
            {uploadMessage}
          </p>
        )}

        {documentsError ? (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-[#fff2ef] p-4 text-sm text-[#9d4237]"
          >
            {documentsError}
          </p>
        ) : documents === null ? (
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-[#f4f5f1]" />
        ) : documents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#dfe3da] px-5 py-10 text-center">
            <p className="text-sm font-medium text-[#555c52]">
              No documents yet
            </p>
            <p className="mt-1 text-sm text-[#858a81]">
              Your uploaded knowledge will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[#e4e7df] text-xs text-[#858a81]">
                <tr>
                  <th scope="col" className="px-10 py-3 font-medium">
                    File Name
                  </th>
                  <th scope="col" className="px-0.5 py-3 font-medium">
                    Upload Date
                  </th>
                  <th scope="col" className="px-0.5 py-3 font-medium">
                    Processing Status
                  </th>
                  <th scope="col" className="px-0.5 py-3 font-medium">
                    Page Count
                  </th>
                  <th scope="col" className="px-0.5 py-3 font-medium">
                    File Size
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#eef0eb]">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="max-w-0 px-10 py-4 font-medium">
                      <span
                        className="block truncate"
                        title={document.originalFilename}
                      >
                        {document.originalFilename}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-0.5 py-4 text-[#64705f]">
                      {new Date(document.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-0.5 py-4">
                      <span className="inline-flex rounded-full bg-[#f1f3ee] px-2.5 py-1 text-xs text-[#64705f]">
                        {document.status === "PROCESSING"
                          ? "Processing..."
                          : document.status.charAt(0) +
                            document.status.slice(1).toLowerCase()}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-0.5 py-4 text-[#64705f]">
                      {document.pageCount ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-0.5 py-4 text-[#64705f]">
                      {formatFileSize(document.fileSize) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
