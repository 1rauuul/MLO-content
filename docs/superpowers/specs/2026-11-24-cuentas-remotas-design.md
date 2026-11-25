# Diseño — Cuentas de alumno en el CMS y progreso en la nube

> Fecha: 24 de noviembre de 2026
> Estado: aprobado e implementado (24 de noviembre de 2026).
> Repos: `mlo-teachers` (CMS/panel) y `MLO-Ingenieria-software` (app Expo).

## 1. Objetivo

Que la cuenta del alumno viva en la base del CMS y que su progreso quede ligado a esa
cuenta, para poder entrar desde otro equipo o después de reinstalar la app sin perder
cursos, clases ni avance.

La app sigue siendo offline-first: después de entrar funciona sin conexión y sube el
progreso cuando vuelve la red. Las cuentas locales existentes se vinculan una vez con su
contraseña, conservando su `externalKey` y sus clases.

## 2. Fuera de alcance

- Recuperación de contraseña por correo.
- Fusión automática de progreso entre dispositivos; la última escritura gana.
- Reportes normalizados de progreso para el docente.
- OAuth, biometría y cambio de contraseña.
- Migrar las rutas de contenido y de unirse a clase a token: siguen usando `externalKey`.

## 3. CMS

### 3.1 Migración

```sql
create table student_accounts (
  student_id uuid primary key references students (id) on delete cascade,
  username text not null unique check (username = lower(username)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_sessions (
  token_hash text primary key,
  student_id uuid not null references students (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index student_sessions_student_idx on student_sessions (student_id);
create index student_sessions_expires_idx on student_sessions (expires_at);

create table student_auth_attempts (
  id bigserial primary key,
  username text not null,
  created_at timestamptz not null default now()
);
create index student_auth_attempts_idx on student_auth_attempts (username, created_at desc);

alter table student_accounts enable row level security;
alter table student_sessions enable row level security;
alter table student_auth_attempts enable row level security;
```

`students` y `student_progress` se reutilizan. Sin políticas RLS, como el resto.

### 3.2 Lógica (`lib/student-auth.ts`)

- Usuario: `^[a-z0-9._-]{3,32}$`, normalizado a minúsculas.
- Contraseña: 8–128 caracteres, con al menos un número o carácter no alfanumérico.
- Nombre visible: 2–80 caracteres.
- `externalKey`: UUID; si no se envía al registrar, el servidor genera uno.
- `registerStudent`: upsert de `students` por `external_key`; si ese alumno ya tiene
  cuenta, `409 already_registered`; inserta la cuenta con `hashPassword` (scrypt) y crea
  sesión.
- `loginStudent`: busca la cuenta, verifica la contraseña, limita a 10 fallos por usuario
  cada 15 minutos y crea sesión. En fallo responde siempre `401 invalid_credentials`.
- `requireStudent`: lee `Authorization: Bearer`, hashea el token y busca una sesión
  vigente; devuelve `{ studentId, externalKey, username, displayName }`.
- `resolveStudent`: Bearer primero; si no hay Bearer, acepta `X-MLO-Student-Key` durante
  la transición y devuelve la identidad del alumno por su `external_key`.
- `logoutStudent`: borra la sesión por hash.
- Sesiones de 30 días; token de 32 bytes; en la DB solo queda su SHA-256.

### 3.3 Endpoints

| Ruta | Contrato |
|---|---|
| `POST /api/mlo/v3/auth/register` | `{ username, password, displayName, externalKey? }` → `201 { token, student: { externalKey, username, displayName } }`; `409` si el usuario o la identidad ya tienen cuenta. |
| `POST /api/mlo/v3/auth/login` | `{ username, password }` → `{ token, student }`; `401` o `429`. |
| `POST /api/mlo/v3/auth/logout` | Bearer → `204`. |
| `GET/PUT /api/mlo/v3/students/me/progress` | Bearer o header legacy. El PUT acepta `studentName` solo por compatibilidad. |
| `GET /api/mlo/v3/students/me/classes` | Bearer o header legacy. |

- Las respuestas llevan `Cache-Control: no-store` y CORS.
- `Access-Control-Allow-Headers` incluye `Authorization`.
- Las rutas de contenido no cambian.

## 4. App

### 4.1 Datos locales

Migración SQLite v23:

```sql
create table remote_session (
  account_id integer primary key references accounts(id) on delete cascade,
  token text,
  expires_at text,
  last_uploaded_hash text,
  last_synced_at text,
  pending_restore integer not null default 0,
  created_at text not null
);
```

- `token` es nullable: al cerrar sesión se borra el token pero se conserva el hash.
- Las cuentas nuevas guardan `password_hash = ''` y `salt = ''`.
- Las cuentas antiguas conservan su hash PBKDF2 solo para el reclamo y el login offline
  de transición.

### 4.2 Autenticación

- Cliente `httpAuth` con `Authorization: Bearer` desde un store en memoria.
- Registro: valida, llama al CMS y después crea la cuenta local. Sin red no se crea
  cuenta nueva.
- Login: llama al CMS; reconcilia la cuenta local por `externalKey`, luego por
  `username`; si no existe, crea la fila local.
- La app guarda token, sesión local y ejecuta la restauración antes de mostrar la app
  como lista. Si falla, entra igual y queda `pending_restore`.
- Cuentas nuevas: sin contraseña local; sin red al entrar, error claro.
- Cuentas antiguas no vinculadas: sin red se permite el login local con su contraseña
  PBKDF2. No se crean cuentas locales nuevas.

### 4.3 Vinculación de cuentas existentes

- Con una sesión local sin token se muestra un aviso para vincular la cuenta.
- Pide la contraseña una vez:
  1. Intenta login remoto.
  2. Si no existe, verifica contra el hash local y registra con el `externalKey` actual.
  3. Si el usuario existe con otra contraseña, muestra credenciales inválidas.
- “Ahora no” mantiene la app local y deja la tarjeta de Perfil para vincular después.

### 4.4 Sincronización automática

- Snapshot = respaldo v5 actual; huella = SHA-256 sin `exportedAt`.
- `ProgressSyncProvider` sube solo si la huella difiere de `last_uploaded_hash`.
- Disparadores: al abrir, al volver a primer plano, al pasar a segundo plano y cada 60 s
  con la app activa.
- Conflicto al iniciar sesión:
  - Cuenta local con progreso y sin hash previo o huella distinta → gana el local y se
    sube.
  - Sin cambios locales pendientes → gana el servidor y se aplica.
  - Identidad remota adoptada distinta → gana el servidor.
- Orden de restauración: token → clases autorizadas → cursos y contenido → progreso.
- Si falla, queda `pending_restore` y se reintenta al volver a primer plano.
- El proveedor no sube un progreso vacío sin hash previo.

### 4.5 UI

- Login: “Tu cuenta y tu progreso se guardan en la nube”.
- Registro: “Podrás entrar desde otro dispositivo”.
- Perfil: estado “Sincronizado”, “Sin conexión”, “Sesión caducada” o “Sin cuenta en la
  nube”, con “Sincronizar ahora” solo como reintento.
- Desaparecen los botones Guardar/Sincronizar.
- Reiniciar progreso sigue pidiendo confirmación; después intenta subir el vacío.

## 5. Seguridad y límites

- scrypt con sal, comparación en tiempo constante, token hasheado y límite de intentos.
- El token se guarda en SQLite; se puede mover a `expo-secure-store` sin cambiar la API.
- `externalKey` sigue siendo una credencial de identidad para contenido y clases.
- Última escritura gana; no hay merge ni sincronización en vivo.
- Sin recuperación de contraseña para cuentas ya vinculadas.

## 6. Verificación

- CMS: `npm test`, `npm run lint`, `npm run build`; migración aplicada.
- App: `npx tsc --noEmit`, `npm test`, `npm run lint`.
- Manual: registrar → avanzar → sync → borrar datos → login → restaurar; vincular cuenta
  antigua; sin red después de entrar; token caducado; límite de intentos.

## 7. Orden de implementación

1. Migración, lógica de auth, rutas y CORS del CMS.
2. Migración SQLite, `remote_session`, `httpAuth` y `useAuth` remoto.
3. Vinculación de cuentas antiguas y fallback offline.
4. Restauración, `ProgressSyncProvider` y Perfil.
5. Tests, documentación y verificación manual.
