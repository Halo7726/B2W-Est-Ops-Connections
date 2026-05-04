"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ItemData,
  getItemDisplaySubtitle,
  getItemDisplayTitle,
} from "@/app/est/resources/[...entity]/components/estResourceFormUtils";

type Props = {
  entity: string;
  initialItems: ItemData[];
};

export default function EstResourceEntityList({ entity, initialItems }: Props) {
  const [items, setItems] = useState<ItemData[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entityPath = useMemo(() => entity.split("/").map(encodeURIComponent).join("/"), [entity]);

  const refreshItems = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/est/resources/${entityPath}?top=20`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh items (${response.status})`);
      }

      const data = await response.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setMessage("List refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (objectId: string) => {
    if (!window.confirm("Remove this item from Est? This action cannot be undone.")) {
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/est/resources/${entityPath}?objectId=${encodeURIComponent(objectId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Delete failed: ${response.status} ${body}`);
      }

      setItems((current) => current.filter((item) => String(item.ObjectID ?? item.objectId ?? item.id) !== objectId));
      setMessage("Item removed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Est Resource</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">{entity}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              View, edit, add, or remove items in Est using a simple resource editor. The list below shows the first {items.length} records.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/est/resources/${entityPath}/new`}
              className="inline-flex items-center justify-center rounded-md bg-cyan-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
            >
              Add new item
            </Link>
            <button
              type="button"
              onClick={refreshItems}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Items</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No items found for this resource.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-4 py-3">ObjectID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => {
                  const objectId = String(item.ObjectID ?? item.objectId ?? item.id ?? `item-${index}`);
                  const displayTitle = getItemDisplayTitle(item);
                  const displaySubtitle = getItemDisplaySubtitle(item);

                  return (
                    <tr key={objectId}>
                      <td className="px-4 py-3 text-slate-800 break-words max-w-[260px]">{objectId}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold text-slate-900">{displayTitle}</div>
                        {displaySubtitle && <div className="text-xs text-slate-500">{displaySubtitle}</div>}
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        <Link
                          href={`/est/resources/${entityPath}/edit/${encodeURIComponent(objectId)}`}
                          className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(objectId)}
                          disabled={loading}
                          className="inline-flex rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
