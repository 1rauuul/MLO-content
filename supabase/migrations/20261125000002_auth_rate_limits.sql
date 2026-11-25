-- Límites de los endpoints públicos de autenticación.
-- Se guardan intentos por IP, por correo (maestros) y globales.
-- No hay políticas RLS: solo la API con el rol postgres la usa.

create table auth_rate_limits (
  id bigserial primary key,
  scope text not null check (scope in ('student_login', 'student_register', 'student_link', 'teacher_login')),
  key text not null,
  created_at timestamptz not null default now()
);

create index auth_rate_limits_scope_key_idx
  on auth_rate_limits (scope, key, created_at desc);

alter table auth_rate_limits enable row level security;
