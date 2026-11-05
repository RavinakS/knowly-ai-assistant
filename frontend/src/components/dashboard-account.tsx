"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";
import { AssistantSection } from "./assistant-section";
import { Documents } from "./documents";

interface OrganizationAccount {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
  assistant: { id: string; token: string; isActive: boolean } | null;
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
        typeof value.assistant.token === "string" &&
        typeof value.assistant.isActive === "boolean"))
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

        <AssistantSection
          assistant={account?.assistant ?? null}
          isLoading={!account && !organizationError}
          hasError={organizationError !== null}
          onAssistantStatusChange={(isActive) =>
            setAccount((current) =>
              current?.assistant
                ? {
                    ...current,
                    assistant: { ...current.assistant, isActive },
                  }
                : current,
            )
          }
        />
      </div>
    </main>
  );
}
