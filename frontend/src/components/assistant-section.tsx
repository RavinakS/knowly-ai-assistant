"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";

interface Assistant {
  id: string;
  token: string;
  isActive: boolean;
}

interface AssistantSectionProps {
  assistant: Assistant | null;
  isLoading: boolean;
  hasError: boolean;
  onAssistantStatusChange: (isActive: boolean) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function AssistantSection({
  assistant,
  isLoading,
  hasError,
  onAssistantStatusChange,
}: AssistantSectionProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const publicAppUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    (typeof window === "undefined" ? "" : window.location.origin);
  const assistantUrl =
    assistant && publicAppUrl
      ? `${publicAppUrl}/assistant/${assistant.token}`
      : null;
  const embedCode =
    assistant && publicAppUrl
      ? `<iframe src="${publicAppUrl}/embed/assistant/${encodeURIComponent(assistant.token)}" width="100%" height="600" style="border:0;" title="Knowly Assistant"></iframe>`
      : "";

  async function copyText(text: string, label: string) {
    setMessage(null);
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied`);
    } catch {
      setMessage("Clipboard access is unavailable in this browser.");
    }
  }

  async function toggleAssistant() {
    if (!apiBaseUrl || !assistant || isUpdating) {
      setMessage("Cannot reach the API to update assistant status.");
      return;
    }

    const nextIsActive = !assistant.isActive;
    setIsUpdating(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/assistants`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setMessage(
          await responseErrorMessage(
            response,
            "Unable to update assistant status.",
          ),
        );
        return;
      }

      const result: unknown = await response.json();
      if (!isRecord(result) || result.isActive !== nextIsActive) {
        setMessage("The API returned an unexpected assistant status.");
        return;
      }

      onAssistantStatusChange(nextIsActive);
      setMessage(
        nextIsActive ? "Assistant activated." : "Assistant deactivated.",
      );
    } catch {
      setMessage("Could not reach the Knowly API.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#e4e7df] bg-white p-5 sm:p-7">
        <div>
          <h2 className="text-lg font-semibold">Assistant</h2>
          <p className="mt-1 text-sm text-[#858a81]">
            Share a public link to your organization&apos;s assistant.
          </p>
        </div>
        {assistantUrl && assistant ? (
          <>
            <div
              className={`mt-5 flex items-start justify-between gap-4 rounded-xl border p-4 ${
                assistant.isActive
                  ? "border-[#dce8dd] bg-[#f2f7f1]"
                  : "border-[#e9e3da] bg-[#f8f6f2]"
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                    assistant.isActive ? "bg-[#4b7957]" : "bg-[#9a8470]"
                  }`}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#283d32]">
                      Active assistant
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        assistant.isActive
                          ? "bg-[#dcebdd] text-[#315b3b]"
                          : "bg-[#ece6de] text-[#705c49]"
                      }`}
                    >
                      {assistant.isActive ? "Live" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#687166]">
                    {assistant.isActive
                      ? "Your assistant is available to answer questions from visitors."
                      : "Your assistant is hidden from visitors and will not answer questions."}
                  </p>
                </div>
              </div>
              <span className="hidden shrink-0 text-xs font-medium text-[#687166] sm:inline">
                {assistant.isActive ? "On" : "Off"}
              </span>
            </div>
            <div className="mt-3 break-all rounded-lg bg-[#f5f6f2] px-3.5 py-3 text-sm text-[#4d594b]">
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
                onClick={() => void toggleAssistant()}
                disabled={isUpdating}
                aria-pressed={assistant.isActive}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  assistant.isActive
                    ? "border border-[#dedfd6] text-[#596154] hover:bg-[#f7f8f5]"
                    : "bg-[#283d32] text-white hover:bg-[#354d3e]"
                }`}
              >
                {isUpdating
                  ? "Updating..."
                  : assistant.isActive
                    ? "Deactivate assistant"
                    : "Activate assistant"}
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
        ) : hasError ? (
          <p role="alert" className="mt-5 text-sm text-[#9d4237]">
            Unable to load assistant information.
          </p>
        ) : isLoading ? (
          <div className="mt-5 h-11 animate-pulse rounded-lg bg-[#f4f5f1]" />
        ) : (
          <p className="mt-5 text-sm text-[#777c73]">
            No assistant is available for this organization.
          </p>
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
        ) : hasError ? (
          <p role="alert" className="mt-5 text-sm text-[#9d4237]">
            Unable to create embed code without assistant information.
          </p>
        ) : isLoading ? (
          <div className="mt-5 h-24 animate-pulse rounded-lg bg-[#f4f5f1]" />
        ) : (
          <p className="mt-5 text-sm text-[#777c73]">
            An assistant is needed to create embed code.
          </p>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm text-[#526a54] lg:col-span-2">
          {message}
        </p>
      )}
    </section>
  );
}