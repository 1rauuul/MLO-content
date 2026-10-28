-- MLO · panel de maestros
-- Core compartido + aportaciones por maestro. El alumno solo ve `releases`,
-- que se componen al publicar.
--
-- RLS sin políticas a propósito: la API pública de Supabase (anon) no puede
-- leer ni escribir estas tablas. La app entra con el rol `postgres`, que no
-- pasa por RLS.

create table teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'maestro' check (role in ('admin', 'maestro')),
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  teacher_id uuid not null references teachers (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_teacher_idx on sessions (teacher_id);

create table courses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  owner_id uuid references teachers (id) on delete cascade,
  is_base boolean not null default false,
  created_at timestamptz not null default now(),
  constraint courses_key_format check (key = 'base' or key ~ '^[a-z0-9]{5}$'),
  constraint courses_base_key check ((key = 'base') = is_base),
  constraint courses_owner check (is_base = (owner_id is null))
);
create unique index courses_single_base on courses (is_base) where is_base;

create table units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  content_id text not null,
  number integer not null check (number > 0),
  title text not null,
  description text not null default '',
  difficulty text not null check (difficulty in ('Fundamental', 'Intermedio', 'Avanzado')),
  color text not null check (color in ('blue', 'violet', 'green')),
  position integer not null default 0,
  archived_at timestamptz,
  unique (course_id, content_id)
);
create index units_course_idx on units (course_id, position);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  unit_id uuid not null references units (id) on delete restrict,
  content_id text not null,
  code text not null,
  title text not null,
  eyebrow text not null default '',
  body text not null default '',
  code_sample text not null default '',
  context_title text not null default '',
  context_body text not null default '',
  synthesis jsonb not null default '[]'::jsonb,
  content jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  archived_at timestamptz,
  unique (course_id, content_id)
);
create index lessons_course_idx on lessons (course_id, unit_id, position);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  content_id text not null,
  title text not null,
  description text not null default '',
  question_count integer not null default 10 check (question_count > 0),
  exercise_count integer not null default 5 check (exercise_count > 0),
  archived_at timestamptz,
  unique (course_id, content_id),
  unique (lesson_id)
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  content_id text not null,
  type text not null check (type in ('order', 'fill', 'match', 'crossword')),
  prompt text not null,
  instructions text not null default '',
  correct_order jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  example jsonb,
  archived_at timestamptz,
  unique (lesson_id, content_id)
);
create index exercises_lesson_idx on exercises (lesson_id);

create table questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  content_id text not null,
  type text not null check (type in ('mcq', 'order', 'fill', 'match', 'crossword')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  archived_at timestamptz,
  unique (lesson_id, content_id)
);
create index questions_lesson_idx on questions (lesson_id);

create table groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete restrict,
  owner_id uuid not null references teachers (id) on delete cascade,
  name text not null,
  -- 6 caracteres sin 0, O, 1, I ni L.
  join_code text not null unique check (join_code ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  active boolean not null default true,
  period text,
  created_at timestamptz not null default now()
);
create index groups_owner_idx on groups (owner_id);

create table releases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  version integer not null check (version > 0),
  schema_version integer not null default 2,
  content_hash text not null,
  published_at timestamptz not null default now(),
  published_by uuid references teachers (id) on delete set null,
  notes text not null default '',
  snapshot jsonb not null,
  unique (course_id, version)
);
create index releases_latest_idx on releases (course_id, version desc);

alter table teachers enable row level security;
alter table sessions enable row level security;
alter table courses enable row level security;
alter table units enable row level security;
alter table lessons enable row level security;
alter table evaluations enable row level security;
alter table exercises enable row level security;
alter table questions enable row level security;
alter table groups enable row level security;
alter table releases enable row level security;
