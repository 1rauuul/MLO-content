import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

async function main() {
  const name = (process.env.ADMIN_NAME ?? "Administrador").trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Define ADMIN_EMAIL y ADMIN_PASSWORD en .env.local antes de ejecutar el seed.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  await db()`insert into teachers (name, email, password_hash, role)
    values (${name}, ${email}, ${await hashPassword(password)}, 'admin')
    on conflict (email) do update
      set name = excluded.name,
          password_hash = excluded.password_hash,
          role = 'admin'`;

  console.log(`Administrador listo: ${email}`);
  await db().end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
