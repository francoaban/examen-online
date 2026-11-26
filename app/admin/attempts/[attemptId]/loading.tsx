export default function Loading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Cargando intento"
    >
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
