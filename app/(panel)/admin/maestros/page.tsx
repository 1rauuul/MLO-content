import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateTeacherForm } from "./create-teacher-form";

type TeacherRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "maestro";
  created_at: Date;
};

export default async function MaestrosPage() {
  await requireAdmin();

  const teachers = await db()<TeacherRow[]>`
    select id, name, email, role, created_at
      from teachers
     order by created_at`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Cuentas de maestros</h1>
        <p className="page-lead">Solo el administrador puede dar de alta cuentas.</p>
      </header>

      <CreateTeacherForm />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-panel min-w-[560px]">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
