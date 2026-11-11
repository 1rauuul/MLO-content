-- Cursos archivados de forma reversible y paleta ampliada para unidades.

begin;

alter table courses add column if not exists archived_at timestamptz;
create index if not exists courses_active_owner_idx
  on courses (owner_id, created_at)
  where archived_at is null and not is_group;

alter table units drop constraint if exists units_color_check;
alter table units add constraint units_color_check
  check (color in ('blue', 'violet', 'green', 'amber', 'orange', 'rose', 'teal'));

commit;
