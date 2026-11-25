/** Devuelve las migraciones `.sql` pendientes, ordenadas por nombre. */
export function pendingMigrations(files: string[], applied: string[]): string[] {
  const done = new Set(applied);
  return files.filter((file) => file.endsWith(".sql") && !done.has(file)).sort();
}
