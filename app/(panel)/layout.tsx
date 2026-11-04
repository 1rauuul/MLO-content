import Link from "next/link";
import type { ReactNode } from "react";

import { requireTeacher } from "@/lib/auth";

import { logout } from "./actions";
import { NavLinks } from "./nav-links";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const teacher = await requireTeacher();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5">
          <Link href="/mis-cursos" className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-[13px] font-semibold text-white">
              M
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">
              MLO <span className="font-normal text-ink-faint">/ Maestros</span>
            </span>
          </Link>

          <NavLinks isAdmin={teacher.role === "admin"} />

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{teacher.name}</span>
            <form action={logout}>
              <button className="btn btn-secondary btn-sm">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
