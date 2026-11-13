export default function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-line" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-line" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card h-28 animate-pulse" />
        <div className="card h-28 animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="card h-16 animate-pulse" />
        <div className="card h-16 animate-pulse" />
        <div className="card h-16 animate-pulse" />
      </div>
    </div>
  );
}
