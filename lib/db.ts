import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { mloSql?: Sql };

/**
 * Cliente perezoso: `next build` importa los módulos sin ejecutar consultas y
 * no debe fallar por falta de variables de entorno.
 */
export function db(): Sql {
  if (!globalForDb.mloSql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "Falta DATABASE_URL. Copia .env.example a .env.local y pega la cadena del pooler de Supabase.",
      );
    }
    globalForDb.mloSql = postgres(url, {
      max: 5,
      // El pooler de Supabase en modo transacción no admite prepared statements.
      prepare: false,
      ssl: "require",
    });
  }
  return globalForDb.mloSql;
}
