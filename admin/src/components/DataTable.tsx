import { useState, useMemo, type ReactNode } from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import EmptyState from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyIcon?: string;
  loading?: boolean;
  pageSize?: number;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  searchFields,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found",
  emptyIcon = "📭",
  loading = false,
  pageSize = 20,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim() || !searchFields) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey as keyof T];
      const bVal = b[sortKey as keyof T];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const toggleSort = (key: string) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="rounded-card bg-white shadow-card">
      {searchFields && (
        <div className="border-b border-border px-3 py-3 sm:px-4">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-input border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-forest-green sm:max-w-xs"
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-text-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium ${col.sortable ? "cursor-pointer select-none hover:text-text" : ""}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8">
                  <EmptyState icon={emptyIcon} title={emptyMessage} />
                </td>
              </tr>
            ) : (
              paginated.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={`transition-colors hover:bg-light-gray ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border sm:hidden">
        {paginated.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState icon={emptyIcon} title={emptyMessage} />
          </div>
        ) : (
          paginated.map((item) => (
            <div
              key={keyExtractor(item)}
              className={`space-y-2 px-3 py-3 ${onRowClick ? "cursor-pointer active:bg-light-gray" : ""}`}
              onClick={() => onRowClick?.(item)}
            >
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-muted">{col.header}</span>
                    <span className="text-right text-sm text-text">{col.render(item)}</span>
                  </div>
                ))}
            </div>
          ))
        )}
      </div>

      {sorted.length > pageSize && (
        <div className="flex flex-col items-center gap-2 border-t border-border px-3 py-3 text-sm sm:flex-row sm:justify-between sm:px-4">
          <span className="text-xs text-text-muted sm:text-sm">
            {sorted.length} total — page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-btn border border-border px-2 py-1 text-xs font-medium text-text-light transition-colors hover:border-text-muted disabled:opacity-40 disabled:cursor-not-allowed sm:px-3"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center gap-1">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-text-muted">…</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={`min-w-[26px] rounded-btn px-1.5 py-1 text-xs font-medium transition-colors sm:min-w-[28px] sm:px-2 ${
                      p === page
                        ? "bg-forest-green text-white"
                        : "border border-border text-text-light hover:border-text-muted"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-btn border border-border px-2 py-1 text-xs font-medium text-text-light transition-colors hover:border-text-muted disabled:opacity-40 disabled:cursor-not-allowed sm:px-3"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
