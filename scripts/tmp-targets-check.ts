import { resolveContentTargets } from "../lib/access";

async function main() {
  const teacher = {
    id: "860961e1-db8c-435a-a6a3-8c5807ddf4b7",
    name: "Eduardo Lopez",
    email: "eduarlo@cinvestav.com",
    role: "maestro" as const,
  };
  const targets = await resolveContentTargets(
    teacher,
    ["e14bad91-eca8-476d-9c6f-a54b71b38716", "7342d955-a670-42e8-9361-1ab4766ca137"],
    "a2daa44b-9cb9-49e9-b320-1c5bf7377c8b",
    "c3b0ec64-bb00-423b-beb4-f8f16bfd0665",
  );
  console.log(
    "error" in targets
      ? targets
      : targets.map((t) => ({ course: t.course.title, topic: t.topicId, unit: t.unitNumber })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
