import { getBaseCourseId } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { listEditableClasses } from "@/lib/classes";
import type { StudioGroup, StudioTopic } from "@/lib/studio";
import { db } from "@/lib/db";

import { ContentStudio } from "./content-studio";

type StudioTopicRow = {
  id: string;
  course_id: string;
  title: string;
  unit_number: number;
  unit_title: string;
};

export default async function ContenidoExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; topicId?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classId, topicId } = await searchParams;

  const [classes, baseId] = await Promise.all([
    listEditableClasses(teacher),
    getBaseCourseId(),
  ]);

  const parentIds = [...new Set(classes.map((klass) => klass.course_id))];
  const parents = parentIds.length
    ? await db()<{ id: string; uses_base: boolean }[]>`
        select id, uses_base from courses where id in ${db()(parentIds)}`
    : [];
  const usesBase = new Map(parents.map((parent) => [parent.id, parent.uses_base]));

  const scopes = new Map<string, string[]>();
  for (const klass of classes) {
    scopes.set(klass.id, [
      klass.course_id,
      ...(usesBase.get(klass.course_id) && baseId ? [baseId] : []),
    ]);
  }
  const sourceIds = [...new Set([...scopes.values()].flat())];

  const topicRows = sourceIds.length
    ? await db()<StudioTopicRow[]>`
        select t.id, t.course_id, t.title,
               u.number as unit_number, u.title as unit_title
          from topics t
          join units u on u.id = t.unit_id
         where t.course_id in ${db()(sourceIds)}
           and t.archived_at is null
           and u.archived_at is null
         order by u.number, t.position, t.id`
    : [];

  const studioGroups: StudioGroup[] = classes.map((klass) => {
    const scope = new Set(scopes.get(klass.id) ?? [klass.course_id]);
    return {
      id: klass.id,
      name: klass.name,
      courseId: klass.content_course_id,
      sourceCourseId: klass.course_id,
      courseTitle: klass.course_title,
      topics: topicRows
        .filter((topic) => scope.has(topic.course_id))
        .map(
          (topic): StudioTopic => ({
            id: topic.id,
            title: topic.title,
            unitNumber: topic.unit_number,
            unitTitle: topic.unit_title,
          }),
        ),
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Contenido de los grupos</h1>
        <p className="page-lead">
          Crea lecciones, ejemplos, ejercicios y evaluaciones para el curso de tus grupos.
        </p>
      </header>

      <ContentStudio
        groups={studioGroups}
        initialGroupId={classes.find((klass) => klass.id === classId)?.id}
        initialTopicId={topicId}
      />
    </div>
  );
}
