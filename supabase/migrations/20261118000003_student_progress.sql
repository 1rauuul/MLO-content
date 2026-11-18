-- Progreso del alumno sincronizado desde MLO (respaldo v5 como JSONB).
-- El endpoint usa la identidad estable X-MLO-Student-Key mientras las cuentas
-- remotas con contraseña quedan como plan aparte.

create table student_progress (
  student_id uuid primary key references students (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table student_progress enable row level security;
