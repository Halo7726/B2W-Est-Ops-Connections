"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVAILABLE_COLUMNS, type ColumnKey } from "@/lib/reports/columns";

type DatePreset = "all" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

type Option = { value: string; label: string };

type AccountInfo = {
  trackingId: string;
  description: string;
  unitOfMeasure: string;
  originalEstimatedQuantity: number | null;
  projectedTotalQuantity: number | null;
  jobNumber: string;
};

type ReportRow = {
  date: string;
  targetQuantity: number;
  trackingId: string;
  jobNumber: string;
  projectManagerId?: string;
  siteSupervisorEmployeeId?: string;
  crewId: string;
  crewForemanEmployeeId: string;
  crewSize: number | null;
  duration: number | null;
  notes: string;
  jobSiteDescription: string;
  productionMethod: string;
  crewWorkType?: string;
  targetMethod?: string;
  productionRate?: number | null;
  unitOfMeasure?: string;
  originalEstimatedQuantity?: number | null;
  changeOrderQuantity?: number | null;
  projectedTotalQuantity?: number | null;
  description?: string;
};

type RunResponse = {
  ok: boolean;
  rows: ReportRow[];
  totalQuantity: number;
  dayCount: number;
  startDate: string;
  endDate: string;
  accountInfo: AccountInfo | null;
  error?: string;
};

function presetLabel(preset: DatePreset): string {
  if (preset === "all") return "All Time";
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
  const [preset, setPreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(["date", "targetQuantity", "crewId", "crewForemanEmployeeId", "crewSize", "duration", "jobSiteDescription", "notes"]);

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [autoSeeding, setAutoSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Track the latest run request to discard stale responses when selections change quickly
  const runSeqRef = useRef(0);

  const canRun = Boolean(jobNumber && trackingId);
  const canExport = Boolean(result && result.rows.length > 0);

  function moveSelectedColumn(index: number, direction: "up" | "down") {
    setSelectedColumns((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  function reorderSelectedColumns(sourceKey: ColumnKey, targetKey: ColumnKey) {
    if (sourceKey === targetKey) return;
    setSelectedColumns((prev) => {
      const sourceIndex = prev.indexOf(sourceKey);
      const targetIndex = prev.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

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
      // Fetch account and fallback entities; tolerate unmapped endpoints.
      const entities = [
        "JobProductionAccount",
        "JobProductionTarget",
        "JobEstimateItem",
        "JobCostBreakdownElement",
        "JobProjectManager",
        "JobSite",
        "Employee",
      ] as const;
      for (const entity of entities) {
        const res = await fetch("/api/ops/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, jobNumber: job, top: 2000 }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if ((!res.ok || !data.ok) && entity === "JobProductionAccount") {
          throw new Error(data.error ?? `Auto-sync of ${entity} failed`);
        }
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

      // Refresh production and fallback data for the selected job.
      const entities = [
        "JobProductionTarget",
        "JobProductionAccount",
        "JobEstimateItem",
        "JobCostBreakdownElement",
        "JobProjectManager",
        "JobSite",
        "Employee",
      ];
      for (const entity of entities) {
        const res = await fetch("/api/ops/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, jobNumber, top: 5000 }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if ((!res.ok || !data.ok) && entity === "JobProductionAccount") {
          throw new Error(data.error ?? `Sync failed for ${entity}`);
        }
      }
      await loadJobs(true);
      await loadAccounts(jobNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  }

  async function fullSyncJob() {
    if (!jobNumber) return;
    setFullSyncing(true);
    setError(null);
    try {
      // Sync all production items for this job (no filtering by tracking ID)
      const entities = [
        "JobProductionTarget",
        "JobProductionAccount",
        "JobEstimateItem",
        "JobCostBreakdownElement",
        "JobProjectManager",
        "JobSite",
        "Employee",
      ];
      for (const entity of entities) {
        const res = await fetch("/api/ops/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, jobNumber, top: 10000 }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if ((!res.ok || !data.ok) && entity === "JobProductionAccount") {
          throw new Error(data.error ?? `Full sync failed for ${entity}`);
        }
      }
      await loadAccounts(jobNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFullSyncing(false);
    }
  }

  const runReport = useCallback(
    async () => {
      if (!jobNumber || !trackingId) return;

      const seq = ++runSeqRef.current;
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
            selectedColumns,
          }),
        });

        const data = (await res.json()) as RunResponse;
        if (seq !== runSeqRef.current) return; // stale response — a newer run started
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to run report");
        setResult(data);
      } catch (err) {
        if (seq === runSeqRef.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (seq === runSeqRef.current) {
          setRunning(false);
        }
      }
    },
    [jobNumber, trackingId, preset, startDate, endDate, selectedColumns]
  );

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time mount only
  }, []);

  useEffect(() => {
    if (jobNumber) {
      void loadAccounts(jobNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAccounts is stable within job scope
  }, [jobNumber]);

  // Auto-run the report whenever the tracking account or date range changes.
  // runReport is excluded from deps intentionally: it is recreated whenever
  // trackingId/preset/startDate/endDate change (the same values listed here),
  // so including it would cause duplicate runs on each change.
  useEffect(() => {
    if (jobNumber && trackingId) {
      void runReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runReport recreates whenever these same deps change
  }, [trackingId, preset, startDate, endDate, selectedColumns]);

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

  const acct = result?.accountInfo;
  const rangeDisplay =
    preset === "all"
      ? "All Time"
      : result
        ? `${result.startDate} to ${result.endDate}`
        : "-";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report Setup</h2>
            <p className="mt-1 text-sm text-slate-600">Pick a job, account, and date range. Report renders automatically.</p>
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
            <span className="text-sm font-medium text-slate-700">Tracking Account</span>
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
              <option value="all">All Time</option>
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
            {syncing ? "Syncing..." : "Refresh Selected"}
          </button>
          <button
            onClick={fullSyncJob}
            disabled={!jobNumber || fullSyncing}
            title="Pull all production items for this job from OPS"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {fullSyncing ? "Syncing All..." : "Sync All Job Items"}
          </button>
          <button
            onClick={() => void runReport()}
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

      {/* Account Details Card */}
      {acct && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Account Details</h2>
          <p className="mt-1 text-sm text-slate-500">Tracking ID: {acct.trackingId}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{acct.description || "—"}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Unit of Measure</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{acct.unitOfMeasure || "—"}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Original Est. Qty</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {acct.originalEstimatedQuantity !== null ? acct.originalEstimatedQuantity.toFixed(2) : "—"}
              </p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Projected Total Qty</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {acct.projectedTotalQuantity !== null ? acct.projectedTotalQuantity.toFixed(2) : "—"}
              </p>
            </article>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Production History
              {running && <span className="ml-2 text-sm font-normal text-slate-500">Loading…</span>}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Range: {rangeDisplay} | Preset: {presetLabel(preset)}
            </p>
          </div>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-print"
          >
            {showColumnPicker ? "Hide" : "Customize"} Columns ({selectedColumns.length})
          </button>
        </div>

        {showColumnPicker && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-medium text-slate-900">Select columns to display:</p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {AVAILABLE_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={(e) =>
                      setSelectedColumns(
                        e.target.checked
                          ? [...selectedColumns, col.key]
                          : selectedColumns.filter((k) => k !== col.key)
                      )
                    }
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setSelectedColumns(["date", "targetQuantity", "crewId", "crewForemanEmployeeId", "crewSize", "duration", "jobSiteDescription", "notes"])}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setSelectedColumns(AVAILABLE_COLUMNS.map((c) => c.key))}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Select All
              </button>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
              <p className="mb-2 text-sm font-medium text-slate-900">Column order (drag to reorder)</p>
              <div className="space-y-1">
                {selectedColumns.map((key, idx) => {
                  const meta = AVAILABLE_COLUMNS.find((c) => c.key === key);
                  if (!meta) return null;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/column-key", key);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceKey = event.dataTransfer.getData("text/column-key") as ColumnKey;
                        if (sourceKey) reorderSelectedColumns(sourceKey, key);
                      }}
                      className="flex cursor-move items-center justify-between rounded border border-slate-200 px-2 py-1"
                    >
                      <span className="text-sm text-slate-700">{idx + 1}. {meta.label}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveSelectedColumn(idx, "up")}
                          disabled={idx === 0}
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelectedColumn(idx, "down")}
                          disabled={idx === selectedColumns.length - 1}
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
                {selectedColumns
                  .map((key) => AVAILABLE_COLUMNS.find((col) => col.key === key))
                  .filter((col): col is (typeof AVAILABLE_COLUMNS)[number] => Boolean(col))
                  .map((col) => (
                  <th key={col.key} className="border-b border-slate-200 px-3 py-2 font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {(result?.rows ?? []).map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                  {selectedColumns
                    .map((key) => AVAILABLE_COLUMNS.find((col) => col.key === key))
                    .filter((col): col is (typeof AVAILABLE_COLUMNS)[number] => Boolean(col))
                    .map((col) => (
                    <td key={col.key} className="border-b border-slate-100 px-3 py-2 text-slate-700 whitespace-nowrap">
                      {(() => {
                        const val = row[col.key];
                        if (val === null || val === undefined) return "—";
                        if (col.type === "number" && typeof val === "number") return val.toFixed(2);
                        return String(val);
                      })()}
                    </td>
                    ))}
                </tr>
              ))}
              {(result?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={selectedColumns.length} className="px-3 py-6 text-center text-slate-500">
                    {running ? "Loading..." : "No data yet. Select a tracking account above."}
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

