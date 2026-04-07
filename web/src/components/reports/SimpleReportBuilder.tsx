"use client";

import { useEffect, useMemo, useState } from "react";

type DatePreset = "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

type Option = { value: string; label: string };

type RunResponse = {
  ok: boolean;
  rows: { date: string; targetQuantity: number; trackingId: string; jobNumber: string }[];
  totalQuantity: number;
  dayCount: number;
  startDate: string;
  endDate: string;
  error?: string;
};

function presetLabel(preset: DatePreset): string {
  if (preset === "last7") return "Last 7 days";
  if (preset === "last30") return "Last 30 days";
  if (preset === "thisMonth") return "This month";
  if (preset === "lastMonth") return "Last month";
  return "Custom range";
}

export default function SimpleReportBuilder() {
  const [jobs, setJobs] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);

  const [jobNumber, setJobNumber] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [preset, setPreset] = useState<DatePreset>("last30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSeeding, setAutoSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const canRun = Boolean(jobNumber && trackingId);
  const canExport = Boolean(result && result.rows.length > 0);

  async function loadJobs(skipAutoSeed = false) {
    setLoadingOptions(true);
    setError(null);
    try {
      const res = await fetch("/api/simple-report/options", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; jobs: Option[]; accounts: Option[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load jobs");
      if (data.jobs.length === 0 && !skipAutoSeed) {
        setLoadingOptions(false);
        await autoSeedJobs();
        return;
      }
      setJobs(data.jobs);
      if (data.jobs.length > 0) {
        setJobNumber((prev) => prev || data.jobs[0].value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function autoSeedJobs() {
    setAutoSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "Job", top: 5000 }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Auto-sync of Job entity failed");
      await loadJobs(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAutoSeeding(false);
    }
  }

  async function loadAccounts(job: string, skipAutoSeed = false) {
    if (!job) return;
    setLoadingOptions(true);
    setError(null);
    try {
      const res = await fetch(`/api/simple-report/options?jobNumber=${encodeURIComponent(job)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok: boolean; accounts: Option[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load accounts");

      if (data.accounts.length === 0 && !skipAutoSeed) {
        setLoadingOptions(false);
        await autoSeedAccounts(job);
        return;
      }

      setAccounts(data.accounts);
      setTrackingId((prev) => {
        if (data.accounts.some((a) => a.value === prev)) return prev;
        return data.accounts[0]?.value ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function autoSeedAccounts(job: string) {
    setAutoSeeding(true);
    setError(null);
    try {
      // Fetch both the accounts definition AND the production history so the report has data
      for (const entity of ["JobProductionAccount", "JobProductionTarget"] as const) {
        const res = await fetch("/api/ops/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, jobNumber: job, top: 2000 }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? `Auto-sync of ${entity} failed`);
      }
      await loadAccounts(job, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAutoSeeding(false);
    }
  }

  async function syncData() {
    if (!jobNumber) return;
    setSyncing(true);
    setError(null);
    try {
      // Refresh full job list (no jobNumber filter)
      const jobRes = await fetch("/api/ops/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "Job", top: 5000 }),
      });
      const jobData = (await jobRes.json()) as { ok: boolean; error?: string };
      if (!jobRes.ok || !jobData.ok) throw new Error(jobData.error ?? "Sync failed for Job");

      // Refresh production data for the selected job
      const entities = ["JobProductionTarget", "JobProductionAccount"];
      for (const entity of entities) {
        const res = await fetch("/api/ops/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, jobNumber, top: 1000 }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? `Sync failed for ${entity}`);
      }
      await loadJobs(true);
      await loadAccounts(jobNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  }

  async function runReport() {
    if (!jobNumber || !trackingId) {
      setError("Please select both a job and account.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/simple-report/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobNumber,
          trackingId,
          preset,
          startDate: preset === "custom" ? startDate : undefined,
          endDate: preset === "custom" ? endDate : undefined,
        }),
      });

      const data = (await res.json()) as RunResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to run report");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    if (jobNumber) {
      void loadAccounts(jobNumber);
    }
  }, [jobNumber]);

  const pdfUrl = useMemo(() => {
    if (!jobNumber || !trackingId) return "#";
    const params = new URLSearchParams({
      jobNumber,
      trackingId,
      preset,
    });
    if (preset === "custom") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    return `/api/simple-report/pdf?${params.toString()}`;
  }, [jobNumber, trackingId, preset, startDate, endDate]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report Setup</h2>
            <p className="mt-1 text-sm text-slate-600">Pick a job, account, and date range. No advanced setup required.</p>
          </div>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
            Guided Workflow
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Job</span>
            <select
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              disabled={loadingOptions || autoSeeding}
            >
              {jobs.length === 0 && <option value="">No jobs found in cache</option>}
              {jobs.map((job) => (
                <option key={job.value} value={job.value}>
                  {job.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Account to Track</span>
            <select
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              disabled={!jobNumber || loadingOptions || autoSeeding}
            >
              {accounts.length === 0 && <option value="">No accounts found for this job</option>}
              {accounts.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Date Range</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as DatePreset)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

          {preset === "custom" && (
            <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected Job</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{jobNumber || "None"}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected Account</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{trackingId || "None"}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Range Mode</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{presetLabel(preset)}</p>
          </article>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 no-print">
          <button
            onClick={syncData}
            disabled={!jobNumber || syncing}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Refresh from OPS"}
          </button>
          <button
            onClick={runReport}
            disabled={running || !canRun}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {running ? "Running..." : "Run Report"}
          </button>
          <a
            href={pdfUrl}
            className={`rounded-md border px-3 py-2 text-sm ${
              canExport
                ? "border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
                : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            Download PDF
          </a>
        </div>

        {autoSeeding && (
          <p className="mt-3 rounded border border-cyan-200 bg-cyan-50 p-2 text-sm text-cyan-800">
            {jobNumber
              ? `No tracking accounts cached for job ${jobNumber} — fetching from OPS...`
              : "No cached jobs found — pulling from OPS..."}
          </p>
        )}
        {error && <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Results</h2>
        <p className="mt-1 text-sm text-slate-600">
          Range: {result?.startDate ?? "-"} to {result?.endDate ?? "-"} | Preset: {presetLabel(preset)}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Quantity</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{result ? result.totalQuantity.toFixed(2) : "0.00"}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Days Returned</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{result?.dayCount ?? 0}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {running ? "Running" : result ? "Completed" : "Waiting"}
            </p>
          </article>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="border-b border-slate-200 px-3 py-2 font-medium">Date</th>
                <th className="border-b border-slate-200 px-3 py-2 font-medium">Target Quantity</th>
              </tr>
            </thead>
            <tbody>
              {(result?.rows ?? []).map((row) => (
                <tr key={row.date} className="odd:bg-white even:bg-slate-50/50">
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.date}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.targetQuantity.toFixed(2)}</td>
                </tr>
              ))}
              {(result?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-slate-500">
                    No data yet. Select filters and run report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
