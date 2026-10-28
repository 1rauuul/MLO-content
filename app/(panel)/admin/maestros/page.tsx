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
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Maestros</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Solo el administrador puede dar de alta cuentas.
        </p>
      </div>

      <CreateTeacherForm />

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Correo</th>
              <th className="px-5 py-3 font-medium">Rol</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-5 py-3 text-zinc-900">{teacher.name}</td>
                <td className="px-5 py-3 text-zinc-600">{teacher.email}</td>
                <td className="px-5 py-3 text-zinc-600">
                  {teacher.role === "admin" ? "Administrador" : "Maestro"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
