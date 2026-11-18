-- Los cambios de estructura (renombrar u ordenar unidades/subtemas) también
-- cuentan como cambios pendientes del grupo.
create or replace function touch_class_structure_change()
returns trigger
language plpgsql
as $$
declare
  v_course uuid;
  v_unit uuid;
  v_topic uuid;
begin
  if tg_table_name = 'units' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    v_course := new.course_id;
    v_unit := new.id;

    insert into class_content_changes (class_id, topic_id, changed_at)
    select c.id, t.id, now()
      from classes c
      join topics t on t.unit_id = v_unit and t.archived_at is null
     where c.content_course_id = v_course
        or c.course_id = v_course
    on conflict (class_id, topic_id)
    do update set changed_at = excluded.changed_at;

    return null;
  end if;

  if tg_table_name = 'topics' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    v_course := new.course_id;
    v_topic := new.id;

    insert into class_content_changes (class_id, topic_id, changed_at)
    select c.id, v_topic, now()
      from classes c
     where c.content_course_id = v_course
        or c.course_id = v_course
    on conflict (class_id, topic_id)
    do update set changed_at = excluded.changed_at;

    return null;
  end if;

  return null;
end;
$$;

create trigger units_class_content_change
  after update on units
  for each row execute function touch_class_structure_change();

create trigger topics_class_content_change
  after insert or update on topics
  for each row execute function touch_class_structure_change();
