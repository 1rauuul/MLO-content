-- X-08 · datos editoriales del curso
-- Descripción y nivel visibles en el alta y la ficha del curso.

alter table courses
  add column description text not null default '',
  add column level text not null default 'Fundamental';

alter table courses
  add constraint courses_level_check
  check (level in ('Fundamental', 'Intermedio', 'Avanzado'));
