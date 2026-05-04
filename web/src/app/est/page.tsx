import Link from "next/link";

const resources = [
  { label: "Equipment", path: "Equipment" },
  { label: "Material", path: "Material" },
  { label: "Laborer", path: "Laborer" },
  { label: "Organization Contact", path: "Organization/Contact" },
  { label: "Organization Vendor", path: "Organization/Vendor" },
  { label: "Category BidAs", path: "Category/BidAs" },
];

export default function EstResourcesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Est Resource Editor</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Manage Est Resources</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Use this section to review and edit core Est resource entities through a secure server-side Est API integration.
          The first pass supports top-level `Resource/...` entities only.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <article key={resource.path} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">{resource.label}</p>
            <p className="mt-2 text-sm text-slate-600">Path: <code>{resource.path}</code></p>
            <Link
              href={`/est/resources/${resource.path}`}
              className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Open resource
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">API access</h2>
        <p className="mt-2 text-sm text-slate-600">
          This app calls Est via server routes under <code>/api/est/resources/*</code> and keeps credentials hidden from the browser.
        </p>
      </section>
    </main>
  );
}
