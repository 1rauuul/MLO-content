-- X-02 · cursos y acceso
-- Referencia opcional al contenido base, estado de publicación, acceso explícito
-- por curso/alumno y releases v3 (metadata vacía hasta X-03). No reescribe datos.

alter table courses
  add column uses_base boolean not null default true,
  add column status text not null default 'draft';

alter table courses
  add constraint courses_status_check
  check (status in ('draft', 'published', 'unpublished'));

-- El base no referencia contenido base. Todo curso con releases v2 cambia a
-- publicado; el resto queda en borrador.
update courses
   set uses_base = false,
       status = 'published'
 where is_base;

update courses c
   set status = 'published'
 where c.status <> 'published'
   and exists (select 1 from releases r where r.course_id = c.id);

create table course_access (
  course_id uuid not null references courses (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references teachers (id) on delete set null,
  primary key (course_id, student_id)
);
create index course_access_student_idx on course_access (student_id);

alter table course_access enable row level security;

-- DEC-05: los alumnos existentes conservan acceso al curso base.
insert into course_access (course_id, student_id)
select c.id, s.id
  from courses c
 cross join students s
 where c.is_base
on conflict (course_id, student_id) do nothing;

-- Releases v3 separadas de las v2. Snapshot = { release }.
create table releases_v3 (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  version integer not null check (version > 0),
  content_hash text not null,
  published_at timestamptz not null default now(),
  published_by uuid references teachers (id) on delete set null,
  snapshot jsonb not null,
  unique (course_id, version)
);
create index releases_v3_latest_idx on releases_v3 (course_id, version desc);

alter table releases_v3 enable row level security;
