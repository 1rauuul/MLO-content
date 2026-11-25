import type { Metadata } from "next";
import Link from "next/link";

import {
  getTeacherTokenPreview,
  isTeacherToken,
} from "@/lib/teacher-accounts";

import { ResetPasswordForm } from "./reset-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restablecer contraseña · MLO",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function InvalidReset() {
  return (
    <>
      <p className="eyebrow">Cuenta de maestro</p>
      <h1 className="page-title mt-2">Este enlace no es válido</h1>
      <p className="page-lead mt-2">
        Solicita un enlace nuevo para restablecer tu contraseña.
      </p>
      <Link href="/recuperar" className="btn btn-primary mt-6 w-full">
        Solicitar otro enlace
      </Link>
    </>
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token || !isTeacherToken(token)) return <InvalidReset />;

  const preview = await getTeacherTokenPreview(token, "reset");
  if (!preview || preview.status !== "pending") return <InvalidReset />;

  return (
    <>
      <p className="eyebrow">Cuenta de maestro</p>
      <h1 className="page-title mt-2">Hola, {preview.name}</h1>
      <p className="page-lead mt-2">
        Elige una nueva contraseña. Al guardarla se cerrarán las sesiones abiertas
        de tu cuenta.
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}
