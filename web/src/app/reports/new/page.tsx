import Link from "next/link";
import ReportBuilderForm from "@/components/reports/ReportBuilderForm";

export default function NewReportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Create Report</h1>
          <p className="text-sm text-zinc-600">Dynamic filters, sort, columns, and aggregation.</p>
        </div>
        <Link href="/reports" className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Back to Reports
        </Link>
      </div>

      <ReportBuilderForm mode="create" />
    </main>
  );
}
