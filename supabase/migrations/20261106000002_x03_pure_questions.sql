-- X-03 · evaluaciones solo de preguntas
-- Una evaluación siempre lleva al menos una pregunta (question_count > 0), pero
-- puede no seleccionar ejercicios (exercise_count = 0). No ejecutar aún.

alter table evaluations
  drop constraint if exists evaluations_exercise_count_check;

alter table evaluations
  add constraint evaluations_exercise_count_check
  check (exercise_count >= 0);
