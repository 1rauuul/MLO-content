"use client";

import { useActionState, useState } from "react";

import {
  createClassInvitation,
  revokeClassInvitation,
  type InvitationResult,
} from "@/lib/actions/classes";
import type { InvitationStatus } from "@/lib/invitations/core";

type InvitationRow = {
  id: string;
  email: string;
  expiresAt: string;
  status: InvitationStatus;
};

const STATUS_LABEL: Record<
  InvitationStatus,
  { label: string; badge: string }
> = {
  pending: { label: "Pendiente", badge: "badge-warning" },
  used: { label: "Usada", badge: "badge-positive" },
  expired: { label: "Vencida", badge: "badge-neutral" },
  revoked: { label: "Revocada", badge: "badge-neutral" },
};

function formatDate(value: string): string {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export function InvitationPanel({
  classId,
  disabled,
}: {
  classId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<InvitationResult, FormData>(
    createClassInvitation,
    {},
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.invitation) return;
    try {
      await navigator.clipboard.writeText(state.invitation.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Invitaciones</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Invita por correo y comparte el enlace de un solo uso. Cualquier dominio es
        válido.
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Entrega por correo: <strong>pendiente de configuración</strong>. No se envía
        ningún correo todavía.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-start gap-3">
        <input type="hidden" name="classId" value={classId} />
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="correo@cualquier-dominio.com"
          aria-label="Correo del alumno"
          className="field min-w-64 flex-1"
        />
        <button
          type="submit"
          disabled={disabled || pending}
          className="btn btn-primary"
        >
          {pending ? "Creando…" : "Crear invitación"}
        </button>
        {disabled && (
          <p className="w-full text-sm text-ink-muted">
            Restaura el grupo para invitar.
          </p>
        )}
        {state.error && (
          <p className="form-error w-full" role="alert">
            {state.error}
          </p>
        )}
      </form>

      {state.invitation && (
        <div className="mt-4 rounded-xl border border-line bg-surface-soft p-4">
          <p className="form-ok" role="status">
            Invitación creada para {state.invitation.email}. Entrega pendiente de
            configuración; no se envió ningún correo.
          </p>
          <label className="field-label mt-3 block" htmlFor="invitation-link">
            Enlace de un solo uso (cópialo ahora)
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="invitation-link"
              readOnly
              value={state.invitation.link}
              onFocus={(event) => event.currentTarget.select()}
              className="field min-w-0 flex-1 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copyLink}
              className="btn btn-secondary btn-sm"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Vence el {formatDate(state.invitation.expiresAt)}. Solo guardamos el
            hash: si pierdes el enlace, revoca esta invitación y crea otra.
          </p>
        </div>
      )}
    </section>
  );
}

export function InvitationHistory({
  classId,
  invitations,
  disabled,
}: {
  classId: string;
  invitations: InvitationRow[];
  disabled: boolean;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Historial</h2>
      <p className="mt-1 text-sm text-ink-muted">
        <span className="tabular-nums">{invitations.length}</span>{" "}
        {invitations.length === 1 ? "invitación" : "invitaciones"}.
      </p>

      {invitations.length === 0 ? (
        <p className="empty mt-3">Todavía no hay invitaciones en este grupo.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {invitation.email}
                </p>
                <p className="text-xs text-ink-muted">
                  Vence <span className="tabular-nums">{formatDate(invitation.expiresAt)}</span>
                </p>
              </div>
              <span className={`badge ${STATUS_LABEL[invitation.status].badge}`}>
                {STATUS_LABEL[invitation.status].label}
              </span>
              {invitation.status === "pending" && !disabled && (
                <form action={revokeClassInvitation}>
                  <input type="hidden" name="classId" value={classId} />
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Revocar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
