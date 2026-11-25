-- Códigos de un solo uso para vincular una cuenta local antigua.
-- Los emite un administrador con `npm run link:student`; sin ese código no se
-- puede reclamar un externalKey.

create table student_link_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_link_codes_window_check
    check (expires_at > created_at)
);

create index student_link_codes_student_idx
  on student_link_codes (student_id, created_at desc);
create unique index student_link_codes_pending_idx
  on student_link_codes (student_id)
  where used_at is null;

alter table student_link_codes enable row level security;
