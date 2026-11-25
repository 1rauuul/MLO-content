-- Invitaciones de maestros y recuperación de contraseña.
-- El maestro nace pendiente (sin contraseña) y se activa desde el enlace del correo.
-- Los tokens solo se guardan hasheados.

alter table teachers add column activated_at timestamptz;
update teachers set activated_at = now()
 where activated_at is null and password_hash <> '';

alter table teachers add constraint teachers_activation_check
  check ((activated_at is null) = (password_hash = ''));

create table teacher_tokens (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  purpose text not null check (purpose in ('invite', 'reset')),
  -- Solo el SHA-256; el token en claro nunca se guarda.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  delivery_error text check (delivery_error in ('not_configured', 'rejected', 'network')),
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint teacher_tokens_state_check
    check (used_at is null or revoked_at is null),
  constraint teacher_tokens_window_check
    check (expires_at > created_at)
);

create index teacher_tokens_teacher_idx
  on teacher_tokens (teacher_id, purpose, created_at desc);
create unique index teacher_tokens_pending_idx
  on teacher_tokens (teacher_id, purpose)
  where used_at is null and revoked_at is null;

alter table teacher_tokens enable row level security;
