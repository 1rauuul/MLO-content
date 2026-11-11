-- Reinicio intencional del entorno de pruebas para recorrer el flujo desde
-- cero. Conserva las cuentas de docentes para poder iniciar sesión de nuevo,
-- pero invalida sus sesiones y elimina todo contenido, grupos y alumnado.

begin;

-- Autenticación temporal: obliga a entrar de nuevo, sin borrar credenciales.
delete from sessions;

-- Datos dependientes de grupos, invitaciones y publicaciones.
delete from class_invitations;
delete from extra_classes;
delete from lesson_extras;
delete from class_members;
delete from class_releases;
delete from class_releases_v3;
delete from classes;

-- Datos de alumnado y permisos de acceso a cursos.
delete from course_access;
delete from students;

-- El borrado en cascada limpia unidades, subtemas, lecciones, actividades,
-- evaluaciones, preguntas, referencias y releases de todos los cursos,
-- incluidos el contenido base y el contenido propio de los grupos.
delete from courses;

commit;
