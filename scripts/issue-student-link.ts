import { db } from "../lib/db";
import { issueStudentLinkCode } from "../lib/student-link";
import { isExternalKey } from "../lib/student-auth";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const sql = db();
  try {
    const name = flag("--name")?.trim();
    if (name) {
      const rows = await sql<{
        external_key: string;
        name: string;
        linked: boolean;
      }[]>`
        select s.external_key, s.name,
               exists(
                 select 1 from student_accounts a where a.student_id = s.id
               ) as linked
          from students s
         where s.name ilike ${`%${name}%`}
         order by s.name, s.external_key
         limit 20`;
      if (rows.length === 0) {
        console.log("No hay alumnos con ese nombre.");
        return;
      }
      for (const row of rows) {
        console.log(
          `${row.name} · ${row.external_key} · ${row.linked ? "ya vinculada" : "sin cuenta"}`,
        );
      }
      console.log("\nVuelve a ejecutar con --external-key <uuid> para emitir el código.");
      return;
    }

    const externalKey = flag("--external-key")?.trim();
    if (!externalKey || !isExternalKey(externalKey)) {
      console.error(
        "Uso: npm run link:student -- --name <texto>\n" +
          "     npm run link:student -- --external-key <uuid>",
      );
      process.exit(1);
    }

    const [student] = await sql<{ id: string; external_key: string; name: string }[]>`
      select id, external_key, name
        from students
       where external_key = ${externalKey}
       limit 1`;
    if (!student) {
      console.error("No existe un alumno con ese externalKey.");
      process.exit(1);
    }

    const issued = await issueStudentLinkCode(student.id);
    if (!issued) {
      console.error("Esa cuenta ya está vinculada o el alumno no existe.");
      process.exit(1);
    }

    console.log(`Código de vinculación para ${student.name}: ${issued.code}`);
    console.log(
      `Vence: ${issued.expiresAt.toLocaleString("es-MX")}. Compártelo solo con el alumno.`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
