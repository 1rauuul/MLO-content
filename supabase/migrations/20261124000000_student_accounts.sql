-- Cuentas de alumno y sesiones remotas.
-- Las cuentas viven en el CMS; MLO deja de ser la fuente de verdad del login.
-- El progreso sigue en student_progress, ligado al mismo students.external_key.

create table student_accounts (
  student_id uuid primary key references students (id) on delete cascade,
  username text not null unique check (username = lower(username)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_sessions (
  token_hash text primary key,
  student_id uuid not null references students (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index student_sessions_student_idx on student_sessions (student_id);
create index student_sessions_expires_idx on student_sessions (expires_at);

create table student_auth_attempts (
  id bigserial primary key,
  username text not null,
  created_at timestamptz not null default now()
);
create index student_auth_attempts_idx on student_auth_attempts (username, created_at desc);

alter table student_accounts enable row level security;
alter table student_sessions enable row level security;
alter table student_auth_attempts enable row level security;
