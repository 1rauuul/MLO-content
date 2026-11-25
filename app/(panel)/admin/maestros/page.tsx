import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateTeacherForm } from "./create-teacher-form";
import { ResendInvitationForm } from "./resend-invitation-form";

type TeacherRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "maestro";
  created_at: Date;
  activated_at: Date | null;
  invite_sent_at: Date | null;
  invite_delivery_error: string | null;
};

const DELIVERY_ERROR: Record<string, string> = {
  not_configured: "falta configurar el correo",
  rejected: "el proveedor rechazó el envío",
  network: "no se pudo conectar con el proveedor",
};

function deliveryNote(teacher: TeacherRow): string {
  if (teacher.invite_sent_at) {
    return `Correo enviado el ${new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Mexico_City",
    }).format(teacher.invite_sent_at)}.`;
  }
  if (teacher.invite_delivery_error) {
    return `Correo no enviado: ${
      DELIVERY_ERROR[teacher.invite_delivery_error] ?? "error de entrega"
    }. Reenvía para copiar el enlace.`;
  }
  return "Invitación pendiente de envío.";
}

export default async function MaestrosPage() {
  await requireAdmin();

  const teachers = await db()<TeacherRow[]>`
    select t.id, t.name, t.email, t.role, t.created_at, t.activated_at,
           tok.sent_at as invite_sent_at,
           tok.delivery_error as invite_delivery_error
      from teachers t
      left join lateral (
        select sent_at, delivery_error
          from teacher_tokens
         where teacher_id = t.id
           and purpose = 'invite'
           and used_at is null
           and revoked_at is null
         order by created_at desc
         limit 1
      ) tok on true
     order by t.created_at`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Cuentas de maestros</h1>
        <p className="page-lead">
          Solo el administrador puede dar de alta cuentas. El maestro recibe una
          invitación por correo y crea su contraseña.
        </p>
      </header>

      <CreateTeacherForm />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-panel min-w-[820px]">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="font-medium text-ink">{teacher.name}</td>
                  <td className="text-ink-muted">{teacher.email}</td>
                  <td>
                    {teacher.role === "admin" ? (
                      <span className="badge badge-brand">Administrador</span>
                    ) : (
                      <span className="badge badge-neutral">Maestro</span>
                    )}
                  </td>
                  <td>
                    {teacher.activated_at ? (
                      <span className="badge badge-positive">Activo</span>
                    ) : (
                      <>
                        <span className="badge badge-warning">
                          Invitación pendiente
                        </span>
                        <p className="mt-1 text-xs text-ink-faint">
                          {deliveryNote(teacher)}
                        </p>
                      </>
                    )}
                  </td>
                  <td>
                    {!teacher.activated_at ? (
                      <ResendInvitationForm teacherId={teacher.id} />
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
