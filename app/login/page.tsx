import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/mis-cursos");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">MLO · Maestros</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-500">Contenido adicional para el curso.</p>
        <LoginForm />
      </div>
    </main>
  );
}
