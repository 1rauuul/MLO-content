-- Imágenes de lecciones. Una sola copia por contenido (sha256) y URL firmada
-- al publicar; el panel puede previsualizarlas con la sesión del maestro.
create table media (
  id uuid primary key default gen_random_uuid(),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null,
  byte_size integer not null check (byte_size > 0),
  sha256 text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid not null references teachers (id) on delete cascade,
  created_at timestamptz not null default now()
);
