-- Cambios de contenido por grupo: permite mostrar qué subtemas cambiaron
-- desde la última publicación sin comparar snapshots completos.
create table class_content_changes (
  class_id uuid not null references classes (id) on delete cascade,
  topic_id uuid not null references topics (id) on delete cascade,
  changed_at timestamptz not null default now(),
  primary key (class_id, topic_id)
);

create index class_content_changes_recent_idx
  on class_content_changes (class_id, changed_at desc);

create or replace function touch_class_content_change()
returns trigger
language plpgsql
as $$
declare
  v_course uuid;
  v_topic uuid;
begin
  if tg_op = 'DELETE' then
    v_course := old.course_id;
    v_topic := old.topic_id;
  else
    v_course := new.course_id;
    v_topic := new.topic_id;
  end if;

  if v_topic is null then
    return null;
  end if;

  insert into class_content_changes (class_id, topic_id, changed_at)
  select c.id, v_topic, now()
    from classes c
   where c.content_course_id = v_course
      or c.course_id = v_course
  on conflict (class_id, topic_id)
  do update set changed_at = excluded.changed_at;

  return null;
end;
$$;

create trigger lessons_class_content_change
  after insert or update or delete on lessons
  for each row execute function touch_class_content_change();

create trigger examples_class_content_change
  after insert or update or delete on examples
  for each row execute function touch_class_content_change();

create trigger exercises_class_content_change
  after insert or update or delete on exercises
  for each row execute function touch_class_content_change();

create trigger evaluations_class_content_change
  after insert or update or delete on evaluations
  for each row execute function touch_class_content_change();
