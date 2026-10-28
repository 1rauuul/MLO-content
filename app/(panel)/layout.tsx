import Link from "next/link";
import type { ReactNode } from "react";

import { requireTeacher } from "@/lib/auth";

import { logout } from "./actions";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const teacher = await requireTeacher();

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <Link href="/mis-cursos" className="text-sm font-semibold text-zinc-900">
            MLO · Maestros
          </Link>

          <nav className="flex items-center gap-5 text-sm text-zinc-600">
            <Link href="/mis-cursos" className="hover:text-zinc-900">
              Mis cursos
            </Link>
            <Link href="/clases" className="hover:text-zinc-900">
              Clases
            </Link>
            <Link href="/contenido-extra" className="hover:text-zinc-900">
              Contenido extra
            </Link>
            {teacher.role === "admin" && (
              <Link href="/admin/maestros" className="hover:text-zinc-900">
                Maestros
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{teacher.name}</span>
            <form action={logout}>
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
