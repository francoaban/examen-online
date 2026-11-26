export default function Loading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Cargando examen"
    >
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>

      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      ))}
    </div>
  );
}
