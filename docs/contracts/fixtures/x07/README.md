# Fixtures · X-07 (invitaciones de un solo uso)

Respuestas del reclamo de invitación. MLO las copia sin editarlas para probar
aceptación, vencimiento, replay, revocación, cupo y membresía única por curso.

## Endpoint

```
POST /api/mlo/v3/invitations/claim
X-MLO-Student-Key: <uuid de accounts.external_key>
Content-Type: application/json

{ "token": "<43 caracteres base64url>", "studentName": "Ana" }
```

`studentName` es opcional; sin él se registra `"Alumno"`. El token es el mismo
valor del deep link `mloingenieriasoftware://join-class?token=...`. No se acepta
un código corto de seis caracteres: ese es el flujo existente de unión por código
de clase.

La respuesta usa CORS abierto y `Cache-Control: no-store`, igual que las rutas v3
existentes. Nunca incluye el correo, el token en claro ni el hash del token.

## Éxito · 200

```json
{
  "ok": true,
  "membership": {
    "studentId": "3f2a7c10-4d1e-4b8a-9f60-2e5c8d7b1a44",
    "classId": "8b1d4e20-6c3f-4a92-b7d5-0e9f2a6c8b13",
    "classCode": "A7K2M9",
    "className": "Grupo A · 2026",
    "teacherName": "Ana Torres",
    "courseId": "c4e2a9d0-7b5f-4c31-8e6a-1d0f3b2a9c57",
    "courseCatalogId": "base",
    "joinedAt": "2026-11-06T18:30:00.000Z"
  },
  "published": {
    "version": 3,
    "hash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "publishedAt": "2026-11-05T20:00:00.000Z"
  }
}
```

`courseCatalogId` es la clave del catálogo (`courses.key`) del curso padre del
grupo; MLO la usa para guardar la membresía en el curso correcto en vez de
asumir `'base'`. `courseId` sigue siendo el UUID interno del curso.

`published` es `null` si el grupo todavía no publicó una versión v2. La membresía
se crea o reactiva y la invitación se marca usada en la misma transacción.

## Errores estables

| Archivo | `error` | HTTP | Cuándo |
|---|---|---|---|
| `expired.json` | `expired` | 410 | Pasaron más de tres días desde la creación |
| `used.json` | `used` | 409 | La invitación ya consumió su único uso |
| `revoked.json` | `revoked` | 410 | El docente la revocó antes de usarla |
| `full.json` | `full` | 409 | El grupo alcanzó su cupo |
| `already-member.json` | `already_member` | 409 | El alumno ya tiene membresía activa en el curso |

Los errores tienen la forma `{ "error": "<código>", "message": "<texto>" }`.
`invalid` (400) cubre identidad ausente, token con formato incorrecto, invitación
inexistente, grupo archivado y el límite de intentos agotado; su mensaje es
siempre «La invitación no es válida.».

## Reglas del token

- 32 bytes aleatorios en base64url (43 caracteres).
- Solo se guarda `SHA-256`; el enlace y el token se muestran una sola vez al
  crearlo. Si se pierde, se revoca y se genera otra invitación.
- Tres días de vigencia, un solo uso y revocable.
- Los fallos incrementan `attempt_count`; al llegar a 10 el reclamo responde
  `invalid` sin revelar si el token existía.

## Política de archivos

- UTF-8 sin BOM, saltos LF.
- SHA-256 sobre los bytes UTF-8 del archivo.
- Sin datos reales de alumnos ni correos reales.

## SHA-256 por archivo

| Archivo | SHA-256 |
|---|---|
| `already-member.json` | `bd9897ddf852ef5c7568d3aa6a1a608cb0e43781f4cf80436c7f6b522c5d2f54` |
| `expired.json` | `94a355cdfb2801b76dcc1485f2ad1c2a0cd121cdf7fe0e2d2611a33ac2c47cb6` |
| `full.json` | `fd179d6e4bb8fb43e3ea89623aed3a40eaebbba70754a5dbc186c8105429b57f` |
| `revoked.json` | `dfe547486f916b34ff6845ec525f01766a9d98928f8e895b90d507edb63eda99` |
| `success.json` | `51516785b638f210b79800c8b0b2b1a2f8914d7505f9e678b75a12425793f626` |
| `used.json` | `2008b390be72c69d1462b4263d2b135e4ae051aa64a97ffd6f5b1e1033eb0d81` |

## Verificación

```sh
node --import tsx --test lib/invitations/invitations.test.ts
```

La prueba valida la forma de los seis fixtures, los códigos y mensajes estables,
y que la respuesta de éxito no exponga correo, token ni hash.
