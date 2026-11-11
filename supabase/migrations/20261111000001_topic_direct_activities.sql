-- El modelo editorial X-03 publica actividades por subtema. La referencia a
-- una lección se conserva solo para contenido histórico de esquema v2.
alter table exercises alter column lesson_id drop not null;
alter table examples alter column lesson_id drop not null;
alter table evaluations alter column lesson_id drop not null;
alter table questions alter column lesson_id drop not null;
