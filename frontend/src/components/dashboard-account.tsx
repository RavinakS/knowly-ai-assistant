"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiBaseUrl,
  responseErrorMessage,
} from "@/lib/auth-api";

interface OrganizationAccount {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
  assistant: { id: string; token: string } | null;
}

interface OrganizationDocument {
  id: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number;
  mimeType: string;
  status: "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOrganizationAccount(value: unknown): value is OrganizationAccount {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.organization)) {
    return false;
  }
  return (
    typeof value.user.id === "string" &&
    typeof value.user.email === "string" &&
    typeof value.user.name === "string" &&
    typeof value.organization.id === "string" &&
    typeof value.organization.name === "string" &&
    (value.assistant === null ||
      (isRecord(value.assistant) &&
        typeof value.assistant.id === "string" &&
        typeof value.assistant.token === "string"))
  );
}

function isDocument(value: unknown): value is OrganizationDocument {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.filename === "string" &&
    typeof value.originalFilename === "string" &&
    typeof value.fileSize === "number" &&
    typeof value.pageCount === "number" &&
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

export function DashboardAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<OrganizationAccount | null>(null);
  const [documents, setDocuments] = useState<OrganizationDocument[] | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(
    apiBaseUrl ? null : "Set NEXT_PUBLIC_API_URL to connect to the Knowly API.",
  );
  const [documentsError, setDocumentsError] = useState<string | null>(
    apiBaseUrl ? null : "Set NEXT_PUBLIC_API_URL to connect to the Knowly API.",
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const publicAppUrl = useMemo(() => {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    return configuredUrl || (typeof window === "undefined" ? "" : window.location.origin);
  }, []);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const controller = new AbortController();
    async function loadDashboard() {
      const responses = await Promise.all([
        fetch(`${apiBaseUrl}/organization/me`, {
          credentials: "include",
          signal: controller.signal,
        }),
        fetch(`${apiBaseUrl}/organization/me/documents`, {
          credentials: "include",
          signal: controller.signal,
        }),
      ]).catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") {
          return null;
        }
        setOrganizationError("Could not reach the Knowly API.");
        setDocumentsError("Could not reach the Knowly API.");
        return null;
      });

      if (!responses) {
        return;
      }
      const [organizationResponse, documentsResponse] = responses;
      if (
        organizationResponse.status === 401 ||
        documentsResponse.status === 401
      ) {
        router.replace("/login");
        return;
      }

      if (!organizationResponse.ok) {
        setOrganizationError(
          await responseErrorMessage(
            organizationResponse,
            "Unable to load your organization.",
          ),
        );
      } else {
        const result: unknown = await organizationResponse.json();
        if (isOrganizationAccount(result)) {
          setAccount(result);
        } else {
          setOrganizationError("The API returned an unexpected organization response.");
        }
      }

      if (!documentsResponse.ok) {
        setDocumentsError(
          await responseErrorMessage(
            documentsResponse,
            "Unable to load your knowledge base.",
          ),
        );
      } else {
        const result: unknown = await documentsResponse.json();
        if (Array.isArray(result) && result.every(isDocument)) {
          setDocuments(result);
        } else {
          setDocumentsError("The API returned an unexpected documents response.");
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [router]);

  const assistantUrl =
    account?.assistant && publicAppUrl
      ? `${publicAppUrl}/assistant/${account.assistant.token}`
      : null;
  const embedCode = assistantUrl
    ? `<iframe src="${assistantUrl}" width="100%" height="600" frameborder="0" title="Knowly Assistant"></iframe>`
    : "";

  const copyText = useCallback(async (text: string, label: string) => {
    setActionMessage(null);
    try {
      await navigator.clipboard.writeText(text);
      setActionMessage(`${label} copied`);
    } catch {
      setActionMessage("Clipboard access is unavailable in this browser.");
    }
  }, []);

  async function handleLogout() {
    if (!apiBaseUrl) {
      setActionMessage("Cannot reach the API to end this session.");
      return;
    }
    setIsLoggingOut(true);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setActionMessage(
          await responseErrorMessage(response, "Unable to log out. Please try again."),
        );
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setActionMessage("Could not reach the API to end this session.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#20231f]">
      <header className="border-b border-[#e7e9e2] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#283d32] text-sm font-semibold text-white">
              K
            </span>
            <span className="text-lg font-semibold tracking-tight">knowly</span>
            <span className="hidden border-l border-[#e7e9e2] pl-3 text-sm text-[#777c73] sm:inline">
              Knowledge Assistant
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-[#dedfd6] px-3.5 py-2 text-sm font-medium text-[#4c554b] hover:bg-[#f7f8f5] disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <section className="mb-8">
          <p className="text-sm font-medium text-[#71856b]">Organization workspace</p>
          {account ? (
            <>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {account.organization.name}
              </h1>
              <p className="mt-2 text-sm text-[#777c73]">
                Signed in as {account.user.name} · {account.user.email}
              </p>
            </>
          ) : organizationError ? (
            <p role="alert" className="mt-3 text-sm text-[#9d4237]">
              {organizationError}
            </p>
          ) : (
            <div className="mt-3 h-8 w-56 animate-pulse rounded bg-[#e8eae3]" />
          )}
        </section>

        {actionMessage && (
          <p role="status" className="mb-5 text-sm text-[#526a54]">
            {actionMessage}
          </p>
        )}

        <section className="rounded-2xl border border-[#e4e7df] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Knowledge base</h2>
              <p className="mt-1 text-sm text-[#858a81]">
                Your organization&apos;s reference documents
              </p>
            </div>
            <button
              type="button"
              disabled
              title="PDF upload will be available in a future step."
              className="cursor-not-allowed rounded-lg bg-[#283d32] px-4 py-2.5 text-sm font-medium text-white opacity-55"
            >
              Upload PDF
            </button>
          </div>

          {documentsError ? (
            <p role="alert" className="mt-6 rounded-lg bg-[#fff2ef] p-4 text-sm text-[#9d4237]">
              {documentsError}
            </p>
          ) : documents === null ? (
            <div className="mt-6 h-24 animate-pulse rounded-xl bg-[#f4f5f1]" />
          ) : documents.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#dfe3da] px-5 py-10 text-center">
              <p className="text-sm font-medium text-[#555c52]">No documents yet</p>
              <p className="mt-1 text-sm text-[#858a81]">
                Your uploaded knowledge will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-[#eef0eb]">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.originalFilename}</p>
                    <p className="mt-1 text-xs text-[#858a81]">
                      {document.pageCount} {document.pageCount === 1 ? "page" : "pages"} ·{" "}
                      {formatFileSize(document.fileSize)}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#f1f3ee] px-2.5 py-1 text-xs text-[#64705f]">
                    {document.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e4e7df] bg-white p-5 sm:p-7">
            <div>
              <h2 className="text-lg font-semibold">Assistant</h2>
              <p className="mt-1 text-sm text-[#858a81]">
                Share a public link to your organization&apos;s assistant.
              </p>
            </div>
            {assistantUrl ? (
              <>
                <div className="mt-5 break-all rounded-lg bg-[#f5f6f2] px-3.5 py-3 text-sm text-[#4d594b]">
                  {assistantUrl}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void copyText(assistantUrl, "Assistant URL")}
                    className="rounded-lg bg-[#283d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#354d3e]"
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Assistant token management will be available later."
                    className="cursor-not-allowed rounded-lg border border-[#dedfd6] px-4 py-2.5 text-sm font-medium text-[#596154] opacity-55"
                  >
                    Regenerate
                  </button>
                </div>
              </>
            ) : organizationError ? (
              <p role="alert" className="mt-5 text-sm text-[#9d4237]">
                Unable to load assistant information.
              </p>
            ) : (
              <div className="mt-5 h-11 animate-pulse rounded-lg bg-[#f4f5f1]" />
            )}
          </div>

          <div className="rounded-2xl border border-[#e4e7df] bg-white p-5 sm:p-7">
            <div>
              <h2 className="text-lg font-semibold">Embed</h2>
              <p className="mt-1 text-sm text-[#858a81]">
                Add the assistant to your organization&apos;s website.
              </p>
            </div>
            {assistantUrl ? (
              <>
                <textarea
                  aria-label="Assistant iframe embed code"
                  readOnly
                  value={embedCode}
                  className="mt-5 min-h-24 w-full resize-none rounded-lg border border-[#e7e9e2] bg-[#f8f9f6] p-3 font-mono text-xs leading-5 text-[#596154] outline-none"
                />
                <button
                  type="button"
                  onClick={() => void copyText(embedCode, "Embed code")}
                  className="mt-4 rounded-lg border border-[#dedfd6] px-4 py-2.5 text-sm font-medium text-[#465044] hover:bg-[#f7f8f5]"
                >
                  Copy Embed Code
                </button>
              </>
            ) : organizationError ? (
              <p role="alert" className="mt-5 text-sm text-[#9d4237]">
                Unable to create embed code without assistant information.
              </p>
            ) : (
              <div className="mt-5 h-24 animate-pulse rounded-lg bg-[#f4f5f1]" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
