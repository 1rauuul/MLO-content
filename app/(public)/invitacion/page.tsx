import type { Metadata } from "next";
import Link from "next/link";

import {
  getTeacherTokenPreview,
  isTeacherToken,
} from "@/lib/teacher-accounts";

import { AcceptInvitationForm } from "./accept-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitación de maestro · MLO",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function InvalidInvitation() {
  return (
    <>
      <p className="eyebrow">Invitación de maestro</p>
      <h1 className="page-title mt-2">Esta invitación no es válida</h1>
      <p className="page-lead mt-2">
        Pide al administrador que te envíe una invitación nueva.
      </p>
      <p className="mt-6 text-center text-xs text-ink-faint">
        <Link href="/login" className="link">
          Volver al inicio de sesión
        </Link>
      </p>
    </>
  );
}

export default async function TeacherInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token || !isTeacherToken(token)) return <InvalidInvitation />;

  const preview = await getTeacherTokenPreview(token, "invite");
  if (!preview) return <InvalidInvitation />;

  if (preview.status === "used" || preview.activatedAt) {
    return (
      <>
        <p className="eyebrow">Invitación de maestro</p>
        <h1 className="page-title mt-2">Tu cuenta ya está activa</h1>
        <p className="page-lead mt-2">
          Inicia sesión con tu contraseña. Si no la recuerdas, puedes restablecerla.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/login" className="btn btn-primary w-full">
            Iniciar sesión
          </Link>
          <Link href="/recuperar" className="btn btn-secondary w-full">
            Recuperar contraseña
          </Link>
        </div>
      </>
    );
  }

  if (preview.status === "revoked") {
    return (
      <>
        <p className="eyebrow">Invitación de maestro</p>
        <h1 className="page-title mt-2">Este enlace fue reemplazado</h1>
        <p className="page-lead mt-2">
          Pide al administrador que reenvíe la invitación y usa el enlace más reciente.
        </p>
      </>
    );
  }

  if (preview.status === "expired") {
    return (
      <>
        <p className="eyebrow">Invitación de maestro</p>
        <h1 className="page-title mt-2">El enlace venció</h1>
        <p className="page-lead mt-2">
          Pide al administrador que reenvíe la invitación para crear tu contraseña.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Invitación de maestro</p>
      <h1 className="page-title mt-2">Hola, {preview.name}</h1>
      <p className="page-lead mt-2">
        Crea tu contraseña para activar tu cuenta de maestro en MLO.
      </p>
      <AcceptInvitationForm token={token} email={preview.email} />
    </>
  );
}
