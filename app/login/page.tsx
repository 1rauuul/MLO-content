import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/mis-cursos");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white">
            M
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            MLO <span className="font-normal text-ink-faint">/ Maestros</span>
          </span>
        </div>

        <div className="card p-8">
          <h1 className="page-title text-xl">Inicia sesión</h1>
          <p className="page-lead mb-7">
            Contenido adicional para el curso de Ingeniería de Software.
          </p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Acceso solo para maestros del curso.
        </p>
      </div>
    </main>
  );
}
