-- Clases del docente: alumnos, contenido extra y publicaciones por clase.
-- El contenido extra se asigna a una o varias clases; cada clase publica su
-- propio snapshot inmutable para que MLO lo descargue y lo use sin conexión.

create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  name text not null,
  -- 6 caracteres sin 0, O, 1, I ni L. Se genera una vez y no cambia.
  join_code text not null unique check (join_code ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);
create index classes_teacher_idx on classes (teacher_id);

create table students (
  id uuid primary key default gen_random_uuid(),
  -- Identidad estable de la persona en MLO. Viaja en el respaldo para que
  -- restaurar el progreso no cree un alumno nuevo.
  external_key text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_members (
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_members_student_idx on class_members (student_id);

create table lesson_extras (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  type text not null check (type in ('lesson', 'example', 'exercise')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_extras_teacher_idx on lesson_extras (teacher_id);
create index lesson_extras_lesson_idx on lesson_extras (lesson_id);

create table extra_classes (
  extra_id uuid not null references lesson_extras (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  primary key (extra_id, class_id)
);
create index extra_classes_class_idx on extra_classes (class_id);

create table class_releases (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  version integer not null check (version > 0),
  schema_version integer not null default 2,
  content_hash text not null,
  published_at timestamptz not null default now(),
  published_by uuid references teachers (id) on delete set null,
  snapshot jsonb not null,
  unique (class_id, version)
);
create index class_releases_latest_idx on class_releases (class_id, version desc);

alter table classes enable row level security;
alter table students enable row level security;
alter table class_members enable row level security;
alter table lesson_extras enable row level security;
alter table extra_classes enable row level security;
alter table class_releases enable row level security;

-- El modelo anterior de un solo grupo por alumno queda reemplazado por clases.
-- La tabla estaba vacía al aplicar esta migración.
drop table groups;
