-- Correo de recuperación y códigos de un solo uso para alumnos.
-- Las cuentas viejas quedan con email null; lo agregan desde el perfil de MLO.

alter table student_accounts add column email text;
alter table student_accounts
  add constraint student_accounts_email_lower
  check (email is null or email = lower(email));

create unique index student_accounts_email_idx
  on student_accounts (email)
  where email is not null;

create table student_password_resets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  -- Solo el SHA-256 del código; el código en claro nunca se guarda.
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_password_resets_window_check
    check (expires_at > created_at)
);

create index student_password_resets_student_idx
  on student_password_resets (student_id, created_at desc);

alter table student_password_resets enable row level security;
