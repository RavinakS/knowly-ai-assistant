"use client";

import { FormEvent, useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";

interface AssistantSource {
  documentName: string;
  pageNumber: number;
}

interface AssistantAnswer {
  answer: string;
  sources: AssistantSource[];
  decision: string;
}

function isAssistantAnswer(value: unknown): value is AssistantAnswer {
  if (typeof value !== "object" || value === null || !("answer" in value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.answer === "string" &&
    typeof candidate.decision === "string" &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every(
      (source) =>
        typeof source === "object" &&
        source !== null &&
        "documentName" in source &&
        typeof source.documentName === "string" &&
        "pageNumber" in source &&
        typeof source.pageNumber === "number",
    )
  );
}

export function PublicAssistant({
  publicId,
  embedded = false,
  title = "Knowledge Assistant",
}: {
  publicId: string;
  embedded?: boolean;
  title?: string;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!apiBaseUrl) {
      setError("The assistant is not available right now.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/public/assistants/${encodeURIComponent(publicId)}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 404
            ? "This assistant is not available."
            : await responseErrorMessage(
                response,
                "Unable to get an answer. Please try again.",
              ),
        );
        return;
      }
      const data: unknown = await response.json();
      if (!isAssistantAnswer(data)) {
        setError("The assistant returned an invalid response.");
        return;
      }
      setResult(data);
    } catch {
      setError("Unable to connect to the assistant. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className={
        embedded
          ? "min-h-screen bg-transparent p-2 text-[#20231f]"
          : "min-h-screen bg-[#faf9f6] px-4 py-12 text-[#20231f]"
      }
    >
      <section
        className={
          embedded
            ? "mx-auto max-w-2xl rounded-xl border border-black/10 bg-white p-4 shadow-sm sm:p-5"
            : "mx-auto max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-9"
        }
      >
        <div className={embedded ? "mb-5" : "mb-8"}>
          {!embedded ? (
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Knowly
            </p>
          ) : null}
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          {!embedded ? (
            <p className="mt-2 text-sm text-neutral-600">
              Ask a question about this organization&apos;s knowledge base.
            </p>
          ) : null}
        </div>

        <form onSubmit={submitQuestion} className="space-y-4">
          <label htmlFor="question" className="block text-sm font-medium">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            required
            rows={4}
            placeholder="What would you like to know?"
            className="w-full resize-y rounded-xl border border-black/15 px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
          />
          <button
            type="submit"
            disabled={isSubmitting || !question.trim()}
            className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? "Thinking..." : "Ask"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {result ? (
          <section aria-live="polite" className="mt-8 border-t border-black/10 pt-6">
            <h2 className="text-lg font-semibold">Answer</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7">{result.answer}</p>
            {result.sources.length ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-neutral-700">Sources</h3>
                <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                  {result.sources.map((source) => (
                    <li key={`${source.documentName}:${source.pageNumber}`}>
                      {source.documentName} — Page {source.pageNumber}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
