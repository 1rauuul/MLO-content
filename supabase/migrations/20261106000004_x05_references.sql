-- X-05 · bibliografía APA 7 (DEC-07)
-- Metadatos estructurados por curso y enlaces a los cinco tipos de elemento.
-- No ejecutar en producción sin backup previo.

create table content_references (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  content_id text not null,
  authors jsonb not null default '[]'::jsonb,
  year integer,
  title text not null,
  source text not null default '',
  edition text not null default '',
  doi text not null default '',
  url text not null default '',
  archived_at timestamptz,
  unique (course_id, content_id)
);
create index content_references_course_idx on content_references (course_id, content_id);

alter table content_references enable row level security;

-- Un enlace por elemento: la FK al elemento limpia la asociación al borrarlo.
create table lesson_references (
  lesson_id uuid not null references lessons (id) on delete cascade,
  reference_id uuid not null references content_references (id) on delete cascade,
  primary key (lesson_id, reference_id)
);

create table evaluation_references (
  evaluation_id uuid not null references evaluations (id) on delete cascade,
  reference_id uuid not null references content_references (id) on delete cascade,
  primary key (evaluation_id, reference_id)
);

create table question_references (
  question_id uuid not null references questions (id) on delete cascade,
  reference_id uuid not null references content_references (id) on delete cascade,
  primary key (question_id, reference_id)
);

create table exercise_references (
  exercise_id uuid not null references exercises (id) on delete cascade,
  reference_id uuid not null references content_references (id) on delete cascade,
  primary key (exercise_id, reference_id)
);

create table example_references (
  example_id uuid not null references examples (id) on delete cascade,
  reference_id uuid not null references content_references (id) on delete cascade,
  primary key (example_id, reference_id)
);

alter table lesson_references enable row level security;
alter table evaluation_references enable row level security;
alter table question_references enable row level security;
alter table exercise_references enable row level security;
alter table example_references enable row level security;
