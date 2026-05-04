"use client";

import EstResourceCreateForm from "@/app/est/resources/[...entity]/components/EstResourceCreateForm";

type Props = {
  params: {
    entity: string[];
  };
};

export default function EstResourceNewPage({ params }: Props) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Create Est Resource</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">New {entity}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Create a new resource item for Est. Required fields and enum values are shown inline for better data entry.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EstResourceCreateForm entity={entity} />
      </section>
    </main>
  );
}
