"use client";

import EstResourceEditForm from "@/app/est/resources/[...entity]/components/EstResourceEditForm";

type Props = {
  params: {
    entity: string[];
    objectId: string;
  };
};

export default function EstResourceEditPage({ params }: Props) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Edit Est Resource</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">{entity}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Edit the selected item and save it back to the Est API. Read-only keys such as <code>ObjectID</code> and <code>AntiTamperToken</code> are preserved.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EstResourceEditForm entity={entity} objectId={params.objectId} />
      </section>
    </main>
  );
}
