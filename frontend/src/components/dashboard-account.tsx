"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";
import { Documents } from "./documents";

interface OrganizationAccount {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
  assistant: { id: string; token: string } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOrganizationAccount(value: unknown): value is OrganizationAccount {
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    !isRecord(value.organization)
  ) {
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

export function DashboardAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<OrganizationAccount | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(
    apiBaseUrl ? null : "Set NEXT_PUBLIC_API_URL to connect to the Knowly API.",
  );

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const publicAppUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    (typeof window === "undefined" ? "" : window.location.origin);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const controller = new AbortController();
    async function loadDashboard() {
      try {
        const response = await fetch(`${apiBaseUrl}/organization/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response) {
          return;
        }
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          setOrganizationError(
            await responseErrorMessage(
              response,
              "Unable to load your organization.",
            ),
          );
        } else {
          const result: unknown = await response.json();
          if (isOrganizationAccount(result)) {
            setAccount(result);
          } else {
            setOrganizationError(
              "The API returned an unexpected organization response.",
            );
          }
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return null;
        }
        setOrganizationError("Could not reach the Knowly API.");
        return null;
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [router]);

  const assistantUrl =
    account?.assistant && publicAppUrl
      ? `${publicAppUrl}/assistant/${account.assistant.token}`
      : null;
  const embedCode =
    assistantUrl && account?.assistant && publicAppUrl
      ? `<iframe src="${publicAppUrl}/embed/assistant/${encodeURIComponent(account.assistant.token)}" width="100%" height="600" style="border:0;" title="Knowly Assistant"></iframe>`
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
          await responseErrorMessage(
            response,
            "Unable to log out. Please try again.",
          ),
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
          <p className="text-sm font-medium text-[#71856b]">
            Organization workspace
          </p>
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

        <Documents />

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
