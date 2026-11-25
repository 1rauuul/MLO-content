# Diseño — Alta de maestros por invitación y recuperación de contraseña

> Fecha: 25 de noviembre de 2026
> Estado: aprobado e implementado (25 de noviembre de 2026).
> Repo: `mlo-teachers` (CMS/panel).

## 1. Objetivo

Que el administrador no cree contraseñas: invita por correo y el maestro crea la suya.
Añadir recuperación de contraseña y una política única de contraseña en front y back
(mínimo 8 caracteres, mayúscula, minúscula, número y símbolo).

## 2. Flujos

### Alta desde el panel

- El administrador captura nombre y correo; desaparece el campo de contraseña.
- Se crea el maestro con `activated_at = null` y `password_hash = ''`.
- Se crea un token de invitación (hash en base, token en el enlace) y se envía el correo.
- Si el correo falla, el panel muestra el enlace para compartirlo.
- La lista muestra “Invitación pendiente” o “Activo” y permite reenviar la invitación.

### Aceptar invitación

- `/invitacion?token=...` valida el token y muestra el nombre.
- El maestro crea su contraseña con checklist y confirmación.
- Se activa la cuenta, se marca el token usado y se inicia sesión; redirige a `/mis-cursos`.
- Tokens usados, vencidos o reemplazados muestran un mensaje claro.

### Recuperar contraseña

- En `/login`: “¿Olvidaste tu contraseña?”.
- `/recuperar` pide correo y responde siempre de forma genérica.
- Si la cuenta está activa: enlace a `/restablecer?token=...` (60 minutos).
- Si sigue pendiente: reenvía la invitación.
- Al restablecer se cambian las credenciales, se invalidan todas las sesiones del maestro
  y se redirige a `/login` con aviso de éxito.
- Un solo token pendiente por maestro y propósito; reenviar revoca el anterior.

## 3. Base de datos

```sql
alter table teachers add column activated_at timestamptz;
update teachers set activated_at = now()
 where activated_at is null and password_hash <> '';

alter table teachers add constraint teachers_activation_check
  check ((activated_at is null) = (password_hash = ''));

create table teacher_tokens (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  purpose text not null check (purpose in ('invite', 'reset')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  delivery_error text check (delivery_error in ('not_configured', 'rejected', 'network')),
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  check (used_at is null or revoked_at is null),
  check (expires_at > created_at)
);

create index teacher_tokens_teacher_idx
  on teacher_tokens (teacher_id, purpose, created_at desc);
create unique index teacher_tokens_pending_idx
  on teacher_tokens (teacher_id, purpose)
  where used_at is null and revoked_at is null;

alter table teacher_tokens enable row level security;
```

Los maestros existentes quedan activos. Los nuevos nacen pendientes.

## 4. Política de contraseña

`lib/password-policy.ts`, compartido:

- 8–128 caracteres.
- Una mayúscula, una minúscula, un número y un carácter especial.

Se valida en los formularios de invitación y restablecimiento, en las acciones del
servidor y en `scripts/seed-admin.ts`. El login solo verifica la contraseña existente.
Las contraseñas débiles anteriores siguen funcionando hasta que se restablezcan.

## 5. Correo

- `lib/email.ts` expone `sendEmail` reutilizable (Resend) y `escapeHtml`.
- `lib/invitations/delivery.ts` reutiliza `sendEmail`.
- `lib/teacher-emails.ts` crea las plantillas de invitación y restablecimiento.
- Invitación: 7 días. Restablecimiento: 60 minutos.
- `APP_BASE_URL` construye los enlaces.
- Si el correo falla en la invitación, el admin ve el enlace. En recuperación la respuesta
  es genérica y el error se registra.

## 6. Seguridad

- Token de 32 bytes; solo SHA-256 en base.
- Un token pendiente por maestro/propósito.
- Solicitudes públicas de recuperación con enfriamiento de 60 segundos por maestro.
- La recuperación no revela si el correo existe.
- Restablecer invalida todas las sesiones del maestro.
- Páginas con token: `noindex` y `referrer: no-referrer`.
- Login de pendiente: error genérico.

## 7. Archivos

**Nuevos:** migración, `lib/password-policy.ts`, `lib/teacher-accounts.ts`,
`lib/teacher-emails.ts`, `app/password-requirements.tsx`, páginas y formularios de
`/invitacion`, `/recuperar` y `/restablecer`, formulario de reenvío en el panel.

**Modificados:** `lib/email.ts`, `lib/invitations/delivery.ts`, acciones, formulario y
lista de maestros, login, `lib/auth.ts`, seed admin, documentación, `package.json`.

## 8. Verificación

- Tests puros de política, tokens y contenido de correos.
- `npm test`, `npm run lint`, `npm run build`.
- Migración aplicada.
- Flujo manual: invitar → aceptar → login; pendiente no entra; reenviar invalida;
  recuperar → restablecer → sesiones viejas invalidadas; tokens inválidos rechazados.

## 9. Decisiones

- “8 dígitos” = mínimo 8 caracteres.
- Auto-login al aceptar invitación; login manual después de restablecer.
- Reenviar invitación solo para pendientes.
- No se obliga a cambiar contraseñas débiles existentes.
