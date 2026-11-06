-- X-04 · grupos con curso interno, cupo, archivo y release v3
-- No ejecutar en esta sesión.

alter table courses add column is_group boolean not null default false;

alter table classes add column course_id uuid references courses (id) on delete restrict;
alter table classes add column content_course_id uuid unique references courses (id) on delete restrict;
alter table classes add column capacity integer;
alter table classes add column archived_at timestamptz;
alter table classes add constraint classes_capacity_check
  check (capacity is null or capacity > 0);

-- Las clases existentes pertenecen al curso base. Los cursos internos se crean
-- de forma perezosa al abrir contenido o publicar.
update classes
   set course_id = (select id from courses where is_base limit 1)
 where course_id is null;

alter table classes alter column course_id set not null;

alter table class_members add column course_id uuid references courses (id) on delete restrict;
alter table class_members add column active boolean not null default true;

update class_members m
   set course_id = c.course_id
  from classes c
 where c.id = m.class_id;

alter table class_members alter column course_id set not null;

-- DEC-06: si hubiera duplicados, conserva la membresía más reciente por curso.
with ranked as (
  select ctid,
         row_number() over (
           partition by student_id, course_id
           order by joined_at desc, class_id
         ) as position
    from class_members
   where active
)
update class_members m
   set active = false
  from ranked r
 where m.ctid = r.ctid
   and r.position > 1;

create unique index class_members_active_course_idx
  on class_members (student_id, course_id)
  where active;
create index class_members_course_idx on class_members (course_id, active);
create index classes_course_idx on classes (course_id, archived_at);

create table class_releases_v3 (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  version integer not null check (version > 0),
  content_hash text not null,
  published_at timestamptz not null default now(),
  published_by uuid references teachers (id) on delete set null,
  snapshot jsonb not null,
  unique (class_id, version)
);
create index class_releases_v3_latest_idx on class_releases_v3 (class_id, version desc);

alter table class_releases_v3 enable row level security;
