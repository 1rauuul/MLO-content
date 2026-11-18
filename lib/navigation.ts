const INTERNAL_PATH = /^\/(?![/\\])/;

/** Ruta de vuelta segura: solo acepta rutas internas del panel. */
export function backTo(value: string | string[] | undefined): string | null {
  return typeof value === "string" && INTERNAL_PATH.test(value) ? value : null;
}
