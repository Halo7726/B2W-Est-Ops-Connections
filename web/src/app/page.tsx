export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Operations Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Production Tracking App</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Run day-to-day production reports with a guided workflow. Select a job, choose an account,
          set a date range, and export a clean PDF in a few clicks.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/reports" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Open Production Report
          </a>
          <a href="/reports/new" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Open Advanced Builder
          </a>
          <a href="/est" className="rounded-md border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100">
            Open Est Resource Editor
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">1. Sync Data</p>
          <p className="mt-2 text-sm text-slate-600">Refresh from OPS to pull current job targets and accounts into local cache.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">2. Choose Filters</p>
          <p className="mt-2 text-sm text-slate-600">Pick a single job, account, and date preset or custom range.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">3. Run & Export</p>
          <p className="mt-2 text-sm text-slate-600">View daily quantities instantly and download the PDF for field teams.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quick Setup Checklist</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Set OPS credentials in .env.local</li>
          <li>Run app from mapped drive X:\web on Windows</li>
          <li>Open Production Report and click Refresh from OPS</li>
        </ol>
      </section>
    </main>
  );
}
