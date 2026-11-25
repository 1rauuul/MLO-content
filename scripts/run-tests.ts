import { spawnSync } from "node:child_process";

import { discoverUnitTests } from "./test-files";

const files = discoverUnitTests(process.cwd());
if (files.length === 0) {
  console.error("No se encontraron tests en lib/.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
