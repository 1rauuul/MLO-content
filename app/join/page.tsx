import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  buildInvitationLink,
  buildMloLocalLink,
  isInvitationToken,
  type InvitationStatus,
} from "@/lib/invitations/core";
import { getInvitationPreview } from "@/lib/invitations/invitations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitación · MLO",
  robots: { index: false, follow: false },
};

const STATUS_MESSAGE: Record<InvitationStatus, string> = {
  pending: "El enlace de invitación está vigente. El código de la clase no vence.",
  used: "Esta invitación ya se usó. Puedes entrar con el código de la clase.",
  expired: "El enlace de invitación venció. Puedes entrar con el código de la clase.",
  revoked: "El docente revocó esta invitación. Puedes entrar con el código de la clase.",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(value);
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="grid flex-1 place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-baseline justify-between px-1">
          <span className="text-xl font-semibold tracking-tight text-ink">MLO</span>
          <span className="eyebrow">Invitación</span>
        </div>
        <section className="card p-6">{children}</section>
        <p className="mt-4 text-center text-xs text-ink-faint">
          MLO · Ingeniería de Software
        </p>
      </div>
    </main>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface-soft p-4">
      <p className="eyebrow">Código de la clase</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.18em] text-ink">
        {code}
      </p>
    </div>
  );
}

function InvalidInvitation() {
  return (
    <Shell>
      <p className="eyebrow">Invitación</p>
      <h1 className="page-title mt-2">
        Esta invitación no es válida
      </h1>
      <p className="page-lead mt-2">
        Pide a tu docente una invitación nueva o únete con el código de la clase.
      </p>
    </Shell>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token || !isInvitationToken(token)) return <InvalidInvitation />;

  const preview = await getInvitationPreview(token);
  if (!preview) return <InvalidInvitation />;

  const expires = formatDate(preview.expiresAt);

  if (preview.archived) {
    return (
      <Shell>
        <p className="eyebrow">Invitación</p>
        <h1 className="page-title mt-2">
          {preview.className}
        </h1>
        <p className="page-lead mt-2">
          El grupo ya no está disponible. Pide una nueva invitación a tu docente.
        </p>
      </Shell>
    );
  }

  const canOpen = preview.status === "pending";
  const localUrl = process.env.MLO_LOCAL_URL?.trim();

  return (
    <Shell>
      <p className="eyebrow">Invitación a un grupo</p>
      <h1 className="page-title mt-2">
        {preview.className}
      </h1>
      <p className="page-lead mt-2">
        {preview.teacherName} te invitó al curso{" "}
        <strong className="font-medium text-ink">{preview.courseTitle}</strong>.
      </p>

      {canOpen ? (
        <a
          href={buildInvitationLink(token)}
          className="btn btn-primary mt-5 w-full"
        >
          Abrir MLO y unirme
        </a>
      ) : (
        <p className="mt-5 rounded-xl border border-line bg-surface-soft p-3 text-sm text-ink-muted">
          {STATUS_MESSAGE[preview.status]}
        </p>
      )}

      {canOpen && localUrl ? (
        <a
          href={buildMloLocalLink(localUrl, token)}
          className="btn btn-secondary mt-2 w-full"
        >
          Abrir MLO local (desarrollo)
        </a>
      ) : null}

      <CodeBlock code={preview.classCode} />

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {canOpen
          ? `Si el botón no abre la app, abre MLO, entra a “Unirme a una clase” y escribe el código. El enlace vence el ${expires}; el código de la clase no vence.`
          : "También puedes abrir MLO, entrar a “Unirme a una clase” y escribir el código de la clase."}
      </p>
    </Shell>
  );
}
