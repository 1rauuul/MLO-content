-- Catálogo de iconos de curso. La clave es compartida con MLO.
alter table courses
  add column icon text not null default 'code';

alter table courses
  add constraint courses_icon_check
  check (icon ~ '^[a-z][a-z0-9-]{0,31}$');
