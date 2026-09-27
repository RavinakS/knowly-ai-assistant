"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiBaseUrl, responseErrorMessage } from "@/lib/auth-api";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!apiBaseUrl) {
      setError("Set NEXT_PUBLIC_API_URL to connect to the Knowly API.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        setError(
          await responseErrorMessage(
            response,
            isRegister
              ? "Unable to create your account."
              : "Unable to sign in.",
          ),
        );
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Could not reach the Knowly API. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-5 py-12 text-[#20231f]">
      <section className="w-full max-w-md rounded-2xl border border-[#e7e6df] bg-white p-7 shadow-[0_24px_80px_-48px_rgba(39,55,40,0.32)] sm:p-9">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#283d32] text-sm font-semibold text-white">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">knowly</span>
        </Link>

        <h1 className="mt-8 text-3xl font-medium tracking-tight">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#73766f]">
          {isRegister
            ? "Start a workspace for your organization."
            : "Sign in to continue to your workspace."}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {isRegister && (
            <>
              <label className="block text-sm font-medium text-[#42483f]">
                Your name
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-[#dedfd6] px-3.5 py-3 font-normal outline-none transition focus:border-[#789b70] focus:ring-2 focus:ring-[#789b70]/20"
                />
              </label>
              <label className="block text-sm font-medium text-[#42483f]">
                Organization name
                <input
                  name="organizationName"
                  type="text"
                  autoComplete="organization"
                  required
                  maxLength={100}
                  className="mt-2 w-full rounded-lg border border-[#dedfd6] px-3.5 py-3 font-normal outline-none transition focus:border-[#789b70] focus:ring-2 focus:ring-[#789b70]/20"
                />
              </label>
            </>
          )}

          <label className="block text-sm font-medium text-[#42483f]">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="mt-2 w-full rounded-lg border border-[#dedfd6] px-3.5 py-3 font-normal outline-none transition focus:border-[#789b70] focus:ring-2 focus:ring-[#789b70]/20"
            />
          </label>

          <label className="block text-sm font-medium text-[#42483f]">
            Password
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={72}
              className="mt-2 w-full rounded-lg border border-[#dedfd6] px-3.5 py-3 font-normal outline-none transition focus:border-[#789b70] focus:ring-2 focus:ring-[#789b70]/20"
            />
            {isRegister && (
              <span className="mt-1.5 block text-xs font-normal text-[#92948c]">
                Use at least 8 characters.
              </span>
            )}
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-[#fff2ef] px-3.5 py-3 text-sm text-[#9d4237]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#283d32] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#354d3e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#73766f]">
          {isRegister ? "Already have an account?" : "New to Knowly?"}{" "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="font-medium text-[#526a54] hover:underline"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
