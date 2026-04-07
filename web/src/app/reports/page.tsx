import Link from "next/link";
import SimpleReportBuilder from "@/components/reports/SimpleReportBuilder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Production Tracking Report</h1>
          <p className="text-sm text-slate-600">Simple mode workflow for operations teams.</p>
        </div>
        <Link href="/reports/new" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Advanced Builder
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Step 1</p>
          <p>Select a job</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Step 2</p>
          <p>Select account and range</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Step 3</p>
          <p>Run and export</p>
        </article>
      </section>

      <SimpleReportBuilder />
    </main>
  );
}
