import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid flex-1 place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-baseline justify-between px-1">
          <span className="text-xl font-semibold tracking-tight text-ink">MLO</span>
          <span className="eyebrow">Maestros</span>
        </div>
        <section className="card p-6">{children}</section>
        <p className="mt-4 text-center text-xs text-ink-faint">
          MLO · Ingeniería de Software
        </p>
      </div>
    </main>
  );
}
