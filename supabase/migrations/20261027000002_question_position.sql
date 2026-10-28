-- Orden de la pregunta dentro de la evaluación. MLO lo usa como order_index
-- al aplicar el payload y el contrato no incluye ese campo por pregunta.

alter table questions add column position integer not null default 0;
