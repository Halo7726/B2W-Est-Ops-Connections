import { notFound } from "next/navigation";
import Link from "next/link";
import ReportRunClient from "@/components/reports/ReportRunClient";
import { getReportById } from "@/lib/reports/repository";

export const runtime = "nodejs";

export default async function RunReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);

  if (!report) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{report.name}</h1>
          <p className="text-sm text-zinc-600">Entity: {report.entity}</p>
        </div>
        <Link href="/reports" className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Back to Reports
        </Link>
      </div>

      <ReportRunClient report={report} />
    </main>
  );
}
