import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#faf9f6] text-[#20231f]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
        <header className="flex h-20 items-center justify-between border-b border-[#e8e7e1]">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Knowly home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#283d32] text-sm font-semibold text-white">
              K
            </span>
            <span className="text-lg font-semibold tracking-tight">knowly</span>
          </Link>
          <span className="rounded-full border border-[#dedfd6] px-3.5 py-1.5 text-xs font-medium text-[#697168]">
            Early foundation
          </span>
        </header>

        <section className="grid flex-1 items-center gap-16 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#edf0e9] px-3.5 py-2 text-xs font-medium text-[#526a54]">
              <span className="size-1.5 rounded-full bg-[#789b70]" />
              Knowledge that moves work forward
            </div>
            <h1 className="text-5xl font-medium leading-[1.08] tracking-[-0.055em] sm:text-6xl">
              Your team&apos;s knowledge,{" "}
              <span className="text-[#7a8b70]">ready to help.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#73766f] sm:text-lg sm:leading-8">
              Knowly is a home for the documents, decisions, and know-how your
              organization depends on—made easier to find and put to use.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#how-it-works"
                className="rounded-lg bg-[#283d32] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#354d3e]"
              >
                Explore the foundation
              </a>
              <span className="text-sm text-[#85877f]">A thoughtful beginning</span>
            </div>
          </div>

          <div
            id="how-it-works"
            className="relative mx-auto w-full max-w-md"
            aria-label="Example of a grounded answer with document references"
          >
            <div className="absolute -inset-5 rounded-[2rem] bg-[#e8ebdf] blur-2xl" />
            <div className="relative rounded-2xl border border-[#e7e6df] bg-white p-5 shadow-[0_24px_80px_-36px_rgba(39,55,40,0.28)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[#efeee9] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#edf0e9] text-sm font-semibold text-[#526a54]">
                    K
                  </span>
                  <span className="text-sm font-semibold">Ask your knowledge</span>
                </div>
                <span className="text-xs text-[#a0a198]">Preview</span>
              </div>
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-[#9a9c93]">
                A question for your organization
              </p>
              <p className="mt-2 text-sm leading-6 text-[#51564f]">
                What&apos;s our process for onboarding a new customer?
              </p>
              <div className="mt-5 rounded-xl bg-[#f7f8f4] p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[#526a54]">
                  <span className="size-1.5 rounded-full bg-[#789b70]" />
                  Answered from your sources
                </div>
                <p className="mt-3 text-sm leading-6 text-[#51564f]">
                  Start by confirming the customer&apos;s goals, then schedule
                  their kickoff and share the setup guide with their team.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-md border border-[#e4e6dd] bg-white px-2.5 py-1.5 text-[11px] text-[#687263]">
                    Customer playbook · p. 4
                  </span>
                  <span className="rounded-md border border-[#e4e6dd] bg-white px-2.5 py-1.5 text-[11px] text-[#687263]">
                    Kickoff checklist · p. 1
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#e8e7e1] py-5 text-xs text-[#92948c] sm:flex-row sm:items-center sm:justify-between">
          <span>Knowly · AI knowledge &amp; decision assistant</span>
          <span>Grounded in your organization&apos;s knowledge.</span>
        </footer>
      </div>
    </main>
  );
}
