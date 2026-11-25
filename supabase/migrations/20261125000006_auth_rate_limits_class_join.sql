-- El join de grupos comparte la tabla de límites con los endpoints de auth.
alter table auth_rate_limits
  drop constraint if exists auth_rate_limits_scope_check,
  add constraint auth_rate_limits_scope_check
  check (scope in (
    'student_login',
    'student_register',
    'student_link',
    'teacher_login',
    'class_join'
  ));
