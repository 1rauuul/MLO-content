-- Orden estable de ejercicios y ejemplos dentro de la lección. Sin esto, el
-- orden depende del plan de consulta y el hash del release puede cambiar sin
-- que cambie el contenido.

alter table exercises add column position integer not null default 0;
alter table examples add column position integer not null default 0;
