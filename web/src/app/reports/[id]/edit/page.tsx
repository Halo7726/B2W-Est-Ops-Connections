import { notFound } from "next/navigation";
import Link from "next/link";
import ReportBuilderForm from "@/components/reports/ReportBuilderForm";
import { getReportById } from "@/lib/reports/repository";

export const runtime = "nodejs";

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);

  if (!report) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Edit Report</h1>
          <p className="text-sm text-zinc-600">Update report logic and save new definition.</p>
        </div>
        <Link href="/reports" className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Back to Reports
        </Link>
      </div>

      <ReportBuilderForm mode="edit" initial={report} />
    </main>
  );
}
