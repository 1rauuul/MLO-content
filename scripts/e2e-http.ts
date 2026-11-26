import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

import { cleanupE2EFixture, seedE2EFixture } from "../lib/api/e2e-fixtures";
import { db } from "../lib/db";

const PORT_START = 3107;
const ORIGIN = "https://web.e2e.test";
const READY_TIMEOUT_MS = 60_000;

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(findFreePort(start + 1));
      } else {
        reject(error);
      }
    });
    probe.listen(start, "127.0.0.1", () => {
      probe.close(() => resolve(start));
    });
  });
}

function stopServer(child: ReturnType<typeof spawn>): void {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function main(): Promise<void> {
  const buildId = join(process.cwd(), ".next", "BUILD_ID");
  try {
    await access(buildId);
  } catch {
    console.error(
      "Falta .next/BUILD_ID. Ejecuta `npm run build` antes de `npm run test:e2e`.",
    );
    process.exit(1);
  }

  const port = await findFreePort(PORT_START);
  const base = `http://127.0.0.1:${port}`;
  const fixture = await seedE2EFixture();
  const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

  const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, CORS_ALLOWED_ORIGIN: ORIGIN },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => (serverOutput += chunk));
  server.stderr.on("data", (chunk) => (serverOutput += chunk));

  try {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      if (server.exitCode !== null) {
        throw new Error(`next start terminó (${server.exitCode}):\n${serverOutput}`);
      }
      try {
        await fetch(`${base}/api/mlo/v3/courses`);
        break;
      } catch {
        if (Date.now() > deadline) {
          throw new Error(`next start no respondió en 60 s:\n${serverOutput}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const check = async (
      label: string,
      path: string,
      init: RequestInit,
      status: number,
      cors = false,
    ): Promise<Response> => {
      const response = await fetch(`${base}${path}`, init);
      assert.equal(response.status, status, `${label}: estado inesperado`);
      if (cors) {
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          ORIGIN,
          `${label}: falta Access-Control-Allow-Origin`,
        );
      }
      console.log(`${label}: ${response.status}`);
      return response;
    };

    await check(
      "OPTIONS join",
      `/api/mlo/v3/classes/${fixture.joinCode}/join`,
      {
        method: "OPTIONS",
        headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
      },
      204,
      true,
    );

    await check(
      "GET preview",
      `/api/mlo/v3/classes/${fixture.joinCode}`,
      { headers: { Origin: ORIGIN } },
      200,
      true,
    );

    const joinResponse = await check(
      "POST join",
      `/api/mlo/v3/classes/${fixture.joinCode}/join`,
      {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "content-type": "application/json",
          "x-forwarded-for": fixture.forwardedFor,
        },
        body: JSON.stringify({
          studentKey: fixture.studentKey,
          studentName: fixture.studentName,
        }),
      },
      200,
      true,
    );
    const joined = (await joinResponse.json()) as { joined?: boolean };
    assert.equal(joined.joined, true, "POST join: la respuesta no confirma la unión");

    await check(
      "GET release",
      `/api/mlo/v3/classes/${fixture.joinCode}/release`,
      { headers: { "x-mlo-student-key": fixture.studentKey, Origin: ORIGIN } },
      200,
    );

    await check("GET courses", "/api/mlo/v3/courses", {
      headers: { "x-mlo-student-key": fixture.studentKey },
    }, 200);

    await check(
      "GET manifest",
      `/api/mlo/v3/catalogs/${fixture.courseKey}/manifest`,
      { headers: { "x-mlo-student-key": fixture.studentKey } },
      200,
    );

    await check("GET clase inexistente", "/api/mlo/v3/classes/Z9Z9Z9", {}, 404);
  } finally {
    stopServer(server);
    await cleanupE2EFixture(fixture);
    await db().end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
