"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { EmailDelivery, EmailDeliveryReason } from "@/lib/email";
import {
  createPendingTeacher,
  resendTeacherInvitation as resendTeacherInvitationRecord,
} from "@/lib/teacher-accounts";

export type TeacherInvitationState = {
  error?: string;
  ok?: boolean;
  email?: string;
  link?: string;
  delivery?: "sent" | "not_configured" | "rejected" | "network";
};

export type CreateTeacherState = TeacherInvitationState;
export type ResendInvitationState = TeacherInvitationState;

function deliveryOf(delivery: EmailDelivery): "sent" | EmailDeliveryReason {
  return delivery.sent ? "sent" : delivery.reason;
}

export async function createTeacher(
  _prev: CreateTeacherState,
  formData: FormData,
): Promise<CreateTeacherState> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "");

  const result = await createPendingTeacher({
    name,
    email,
    invitedBy: admin.id,
  });

  if (!result.ok) {
    if (result.error === "invalid_name") {
      return { error: "Escribe el nombre del maestro (2 a 80 caracteres)." };
    }
    if (result.error === "invalid_email") {
      return { error: "Escribe un correo válido." };
    }
    if (result.error === "email_taken") {
      return {
        error:
          "Ya existe una cuenta con ese correo. Revisa la lista para reenviar la invitación.",
      };
    }
    if (result.error === "config") {
      return { error: "Falta APP_BASE_URL para armar el enlace de invitación." };
    }
    return { error: "No se pudo crear la invitación." };
  }

  revalidatePath("/admin/maestros");
  return {
    ok: true,
    email: result.email,
    link: result.link,
    delivery: deliveryOf(result.delivery),
  };
}

export async function resendInvitation(
  _prev: ResendInvitationState,
  formData: FormData,
): Promise<ResendInvitationState> {
  const admin = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "").trim();

  const result = await resendTeacherInvitationRecord(teacherId, admin.id);
  if (!result.ok) {
    if (result.error === "not_found") {
      return { error: "Ese maestro ya no existe." };
    }
    if (result.error === "already_active") {
      return { error: "La cuenta ya está activa; no necesita invitación." };
    }
    if (result.error === "config") {
      return { error: "Falta APP_BASE_URL para armar el enlace de invitación." };
    }
    return { error: "No se pudo reenviar la invitación." };
  }

  revalidatePath("/admin/maestros");
  return {
    ok: true,
    email: result.email,
    link: result.link,
    delivery: deliveryOf(result.delivery),
  };
}
