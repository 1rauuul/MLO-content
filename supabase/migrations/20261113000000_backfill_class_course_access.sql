-- X-02: un alumno con membresía activa en un grupo debe poder descargar el
-- curso de ese grupo. Las altas creadas antes de que el alta concediera
-- `course_access` quedaron solo con el acceso al base y MLO no listaba el curso.
insert into course_access (course_id, student_id)
select distinct c.course_id, m.student_id
  from class_members m
  join classes c on c.id = m.class_id
 where m.active
on conflict (course_id, student_id) do nothing;

-- El base se mantiene accesible aunque el control de acceso esté encendido.
insert into course_access (course_id, student_id)
select b.id, s.id
  from courses b
 cross join students s
 where b.is_base
on conflict (course_id, student_id) do nothing;
