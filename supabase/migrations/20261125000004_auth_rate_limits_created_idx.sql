-- Índice para la limpieza global del limiter (borra por created_at).
create index auth_rate_limits_created_idx
  on auth_rate_limits (created_at);
