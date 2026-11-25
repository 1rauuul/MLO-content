/** Devuelve las migraciones `.sql` pendientes, ordenadas por nombre. */
export function pendingMigrations(files: string[], applied: string[]): string[] {
  const done = new Set(applied);
  return files.filter((file) => file.endsWith(".sql") && !done.has(file)).sort();
}

/** Archivos históricos hasta `cutoff`, para el baseline de una base existente. */
export function migrationsUpTo(files: string[], cutoff: string): string[] {
  return files.filter((file) => file.endsWith(".sql") && file <= cutoff).sort();
}
