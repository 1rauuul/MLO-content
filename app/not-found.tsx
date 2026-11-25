import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada · MLO",
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white">
            M
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            MLO <span className="font-normal text-ink-faint">/ Maestros</span>
          </span>
        </div>

        <section className="card p-6">
          <h1 className="page-title">No encontramos esta página</h1>
          <p className="page-lead mt-2">
            Puede que el enlace haya cambiado o que el contenido ya no exista.
          </p>
          <Link href="/mis-cursos" className="btn btn-primary mt-5 w-full">
            Volver a mis cursos
          </Link>
        </section>

        <p className="mt-4 text-center text-xs text-ink-faint">
          MLO · Ingeniería de Software
        </p>
      </div>
    </main>
  );
}
