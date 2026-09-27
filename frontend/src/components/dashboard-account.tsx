"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";

interface Account {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
}

function isAccount(value: unknown): value is Account {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const account = value as Record<string, unknown>;
  if (
    typeof account.user !== "object" ||
    account.user === null ||
    typeof account.organization !== "object" ||
    account.organization === null
  ) {
    return false;
  }
  const user = account.user as Record<string, unknown>;
  const organization = account.organization as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.name === "string" &&
    typeof organization.id === "string" &&
    typeof organization.name === "string"
  );
}

export function DashboardAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(
    apiBaseUrl ? null : "Set NEXT_PUBLIC_API_URL to connect to the Knowly API.",
  );

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setError(await responseErrorMessage(response, "Unable to load your account."));
          return;
        }
        const result: unknown = await response.json();
        if (!isAccount(result)) {
          setError("The API returned an unexpected account response.");
          return;
        }
        setAccount(result);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return;
        }
        setError("Could not reach the Knowly API. Check that the backend is running.");
      }
    }

    void loadAccount();
    return () => controller.abort();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#faf9f6] px-5 py-12 text-[#20231f]">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-[#e8e7e1] pb-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#283d32] text-sm font-semibold text-white">
              K
            </span>
            <span className="text-lg font-semibold tracking-tight">knowly</span>
          </Link>
          <span className="text-sm text-[#85877f]">Account verification</span>
        </header>

        <section className="mt-12">
          <p className="text-sm font-medium text-[#789b70]">You&apos;re signed in</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">
            Your Knowly account
          </h1>
          {account ? (
            <div className="mt-7 rounded-2xl border border-[#e7e6df] bg-white p-6 sm:p-8">
              <dl className="grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#92948c]">
                    Name
                  </dt>
                  <dd className="mt-2 text-base font-medium">{account.user.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#92948c]">
                    Email
                  </dt>
                  <dd className="mt-2 text-base font-medium">{account.user.email}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#92948c]">
                    Organization
                  </dt>
                  <dd className="mt-2 text-base font-medium">
                    {account.organization.name}
                  </dd>
                </div>
              </dl>
            </div>
          ) : error ? (
            <p role="alert" className="mt-6 rounded-lg bg-[#fff2ef] p-4 text-sm text-[#9d4237]">
              {error}
            </p>
          ) : (
            <p className="mt-6 text-sm text-[#73766f]">Loading your account...</p>
          )}
        </section>
      </div>
    </main>
  );
}
