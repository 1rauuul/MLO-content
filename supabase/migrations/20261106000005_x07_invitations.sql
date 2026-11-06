-- X-07 · invitaciones de un solo uso
-- No ejecutar en esta sesión: el coordinador respalda y aplica después.

create table class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  -- Copia del curso padre para validar la membresía única por curso sin joins.
  course_id uuid not null references courses (id) on delete restrict,
  email text not null,
  -- Solo el SHA-256; el token en claro nunca se guarda.
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cualquier dominio; solo se valida el formato y se guarda normalizado.
  constraint class_invitations_email_check
    check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint class_invitations_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint class_invitations_window_check
    check (expires_at > created_at),
  constraint class_invitations_state_check
    check (used_at is null or revoked_at is null)
);

create unique index class_invitations_token_hash_idx
  on class_invitations (token_hash);
create index class_invitations_class_idx
  on class_invitations (class_id, created_at desc);

alter table class_invitations enable row level security;
