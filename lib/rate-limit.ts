import { db } from "./db";

export type RateLimitScope =
  | "student_login"
  | "student_register"
  | "student_link"
  | "teacher_login";

export type RateLimitRule = {
  limit: number;
  windowMinutes: number;
};

type HeaderBag = { get(name: string): string | null };

const WINDOW_MINUTES = 15;
const CLEANUP_MINUTES = 24 * 60;

export const RATE_LIMITS = {
  studentLoginIp: { limit: 30, windowMinutes: WINDOW_MINUTES },
  studentLoginGlobal: { limit: 500, windowMinutes: WINDOW_MINUTES },
  studentRegisterIp: { limit: 10, windowMinutes: WINDOW_MINUTES },
  studentRegisterGlobal: { limit: 100, windowMinutes: WINDOW_MINUTES },
  studentLinkIp: { limit: 10, windowMinutes: WINDOW_MINUTES },
  studentLinkGlobal: { limit: 100, windowMinutes: WINDOW_MINUTES },
  teacherLoginIp: { limit: 20, windowMinutes: WINDOW_MINUTES },
  teacherLoginEmail: { limit: 10, windowMinutes: WINDOW_MINUTES },
  teacherLoginGlobal: { limit: 200, windowMinutes: WINDOW_MINUTES },
} satisfies Record<string, RateLimitRule>;

/** En Vercel la IP real viene en el primer valor de x-forwarded-for. */
export function clientIpFromHeaders(headers: HeaderBag): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Devuelve `false` si la clave ya agotó su ventana. La limpieza es global para
 * que rotar usuarios o IPs no haga crecer la tabla.
 */
export async function takeRateLimit(
  scope: RateLimitScope,
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const sql = db();
  await sql`delete from auth_rate_limits
    where created_at < now() - make_interval(mins => ${CLEANUP_MINUTES})`;

  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count
      from auth_rate_limits
     where scope = ${scope}
       and key = ${key}
       and created_at > now() - make_interval(mins => ${rule.windowMinutes})`;
  if ((row?.count ?? 0) >= rule.limit) return false;

  await sql`insert into auth_rate_limits (scope, key)
    values (${scope}, ${key})`;
  return true;
}
