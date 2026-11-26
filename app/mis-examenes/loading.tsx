export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10"
      role="status"
      aria-busy="true"
      aria-label="Cargando exámenes"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" />
      </div>

      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      ))}
    </main>
  );
}
