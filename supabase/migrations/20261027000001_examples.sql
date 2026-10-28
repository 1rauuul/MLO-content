-- Ejemplos independientes de una lección (los de un ejercicio viajan dentro
-- de exercises.example). Forman parte del contrato v2 y del release.

create table examples (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  content_id text not null,
  type text not null check (type in ('order', 'fill', 'match', 'crossword')),
  title text not null,
  prompt text not null,
  config jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  hints jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  archived_at timestamptz,
  unique (lesson_id, content_id)
);
create index examples_lesson_idx on examples (lesson_id);

alter table examples enable row level security;
