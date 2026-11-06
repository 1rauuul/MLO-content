-- X-03 · subtemas y actividades por subtema
-- Conserva las columnas v2 (lesson_id) y añade topic_id / evaluation_id.
-- No ejecutar en producción desde esta sesión.

create table topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  unit_id uuid not null references units (id) on delete cascade,
  content_id text not null,
  title text not null,
  summary text not null default '',
  position integer not null default 0,
  archived_at timestamptz,
  unique (course_id, content_id)
);
create index topics_unit_idx on topics (unit_id, position);
create index topics_course_idx on topics (course_id, position);

alter table topics enable row level security;

-- DEC-03: cada lección v2 se convierte en un subtema nuevo. La lección
-- conserva su id y se convierte en la primera lección del subtema.
insert into topics (course_id, unit_id, content_id, title, summary, position, archived_at)
select l.course_id, l.unit_id, 't-' || l.content_id, l.title, '', l.position,
       l.archived_at
  from lessons l
on conflict (course_id, content_id) do nothing;

alter table lessons add column topic_id uuid references topics (id) on delete cascade;
alter table exercises add column topic_id uuid references topics (id) on delete cascade;
alter table examples add column topic_id uuid references topics (id) on delete cascade;
alter table evaluations add column topic_id uuid references topics (id) on delete cascade;
alter table evaluations add column position integer not null default 0;

update lessons l
   set topic_id = t.id
  from topics t
 where t.course_id = l.course_id
   and t.content_id = 't-' || l.content_id;

update exercises x
   set topic_id = l.topic_id
  from lessons l
 where l.id = x.lesson_id;

update examples x
   set topic_id = l.topic_id
  from lessons l
 where l.id = x.lesson_id;

update evaluations e
   set topic_id = l.topic_id
  from lessons l
 where l.id = e.lesson_id;

alter table lessons alter column topic_id set not null;
alter table exercises alter column topic_id set not null;
alter table examples alter column topic_id set not null;
alter table evaluations alter column topic_id set not null;

create index lessons_topic_idx on lessons (topic_id, position);
create index exercises_topic_idx on exercises (topic_id, position);
create index examples_topic_idx on examples (topic_id, position);
create index evaluations_topic_idx on evaluations (topic_id, position);

-- Las preguntas pasan de estar ligadas por lesson_id a evaluation_id.
alter table questions add column evaluation_id uuid references evaluations (id) on delete cascade;

update questions q
   set evaluation_id = e.id
  from evaluations e
 where e.lesson_id = q.lesson_id;

alter table questions alter column evaluation_id set not null;
create index questions_evaluation_idx on questions (evaluation_id, position);

-- Selección explícita de ejercicios por evaluación. El backfill usa el cupo
-- v2 (exercise_count) y, si hay menos, todos los de la lección.
create table evaluation_exercises (
  evaluation_id uuid not null references evaluations (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  primary key (evaluation_id, exercise_id)
);
create index evaluation_exercises_exercise_idx on evaluation_exercises (exercise_id);

insert into evaluation_exercises (evaluation_id, exercise_id)
select e.id, selected.id
  from evaluations e
  join lateral (
    select x.id
      from exercises x
     where x.lesson_id = e.lesson_id
       and x.archived_at is null
     order by x.position, x.content_id
     limit e.exercise_count
  ) selected on true
 where e.archived_at is null
on conflict do nothing;

alter table evaluation_exercises enable row level security;

-- X-03 permite N evaluaciones por subtema; la lección ya no es única.
alter table evaluations
  drop constraint if exists evaluations_lesson_id_key;
