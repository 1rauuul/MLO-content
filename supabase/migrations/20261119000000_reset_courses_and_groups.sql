-- Limpieza para pruebas reales: borra todos los grupos y todos los cursos
-- excepto el curso base. Conserva docentes, alumnos, sesiones, media y el
-- contenido del curso base (con sus accesos y referencias).
--
-- El APK se limpia con su propia migración (v22) y ambos lados vuelven a
-- sincronizarse desde cero.
--
-- Se elimina también el progreso de los alumnos guardado en la nube.

DO $$
BEGIN
  IF to_regclass('public.student_progress') IS NOT NULL THEN
    DELETE FROM public.student_progress;
  END IF;
END $$;

-- Grupos: la cascada borra miembros, invitaciones, cambios, releases y extras.
DELETE FROM classes;

-- Contenido de los cursos no base, de hijos a padres: las lecciones arrastran
-- evaluaciones, preguntas, ejemplos, ejercicios y extras.
DELETE FROM lessons
 WHERE course_id IN (SELECT id FROM courses WHERE NOT is_base);

DELETE FROM topics
 WHERE course_id IN (SELECT id FROM courses WHERE NOT is_base);

DELETE FROM units
 WHERE course_id IN (SELECT id FROM courses WHERE NOT is_base);

-- La cascada borra releases, referencias y accesos del curso.
DELETE FROM courses
 WHERE NOT is_base;
