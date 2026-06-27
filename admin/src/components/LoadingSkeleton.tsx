interface LoadingSkeletonProps {
  rows?: number;
  type?: "table" | "card" | "detail";
}

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-light-gray ${className}`} />;
}

export default function LoadingSkeleton({ rows = 4, type = "table" }: LoadingSkeletonProps) {
  if (type === "card") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-card bg-white p-5 shadow-card">
            <Bar className="mb-3 h-4 w-2/3" />
            <Bar className="mb-2 h-3 w-full" />
            <Bar className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "detail") {
    return (
      <div className="space-y-4 rounded-card bg-white p-6 shadow-card">
        <Bar className="h-5 w-1/3" />
        <Bar className="h-4 w-2/3" />
        <Bar className="h-4 w-1/2" />
        <div className="pt-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Bar key={i} className="mb-2 h-3 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-white shadow-card">
      <div className="space-y-0 divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <Bar key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
