-- La tabla media se creó sin RLS. El panel entra como `postgres` y no pasa por
-- RLS, pero PostgREST (anon/authenticated) no debe leer ni escribir imágenes.
alter table media enable row level security;
