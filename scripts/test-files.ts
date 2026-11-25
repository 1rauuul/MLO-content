import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Recorre `lib/**` y devuelve los tests unitarios, sin los `*.db.test.ts`. */
export function discoverUnitTests(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".test.ts") && !entry.name.endsWith(".db.test.ts")) {
        files.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(join(root, "lib"));
  return files.sort();
}
