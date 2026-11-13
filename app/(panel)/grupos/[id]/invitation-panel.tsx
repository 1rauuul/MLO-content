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

const DELIVERY_FAILURE: Record<
  Exclude<"sent" | "not_configured" | "rejected" | "network", "sent">,
  string
> = {
  not_configured: "falta configurar el proveedor de correo",
  rejected: "el proveedor rechazó el envío",
  network: "no se pudo conectar con el proveedor",
};

function formatDate(value: string): string {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export function InvitationPanel({
  classId,
  disabled,
  published,
}: {
  classId: string;
  disabled: boolean;
  published: boolean;
}) {
  const [state, action, pending] = useActionState<InvitationResult, FormData>(
    createClassInvitation,
    {},
  );
  const [copied, setCopied] = useState(false);
  const blocked = disabled || !published;

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
        Crearemos la invitación y la enviaremos por correo. Si el envío falla, podrás
        copiar el enlace.
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
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "invitation-error" : undefined}
          className="field min-w-0 flex-1 sm:min-w-64"
        />
        <button
          type="submit"
          disabled={blocked || pending}
          className="btn btn-primary"
        >
          {pending ? "Creando…" : "Crear invitación"}
        </button>
        {disabled && (
          <p className="w-full text-sm text-ink-muted">
            Restaura el grupo para invitar.
          </p>
        )}
        {!disabled && !published && (
          <p className="w-full text-sm text-ink-muted">
            Publica el grupo para invitar: los alumnos podrán unirse a partir de la
            publicación.
          </p>
        )}
        {state.error && (
          <p id="invitation-error" className="form-error w-full" role="alert">
            {state.error}
          </p>
        )}
      </form>

      {state.invitation && (
        <div className="mt-4 rounded-xl border border-line bg-surface-soft p-4">
          {state.invitation.delivery === "sent" ? (
            <p className="form-ok" role="status">
              Invitación enviada a {state.invitation.email}.
            </p>
          ) : (
            <p className="text-sm text-warning" role="status">
              Invitación creada para {state.invitation.email}, pero no se envió el
              correo ({DELIVERY_FAILURE[state.invitation.delivery]}). Copia el enlace
              y compártelo.
            </p>
          )}
          <label className="field-label mt-3 block" htmlFor="invitation-link">
            Enlace de un solo uso (por si necesitas compartirlo)
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
