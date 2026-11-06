# Fixtures · X-03 (subtemas y actividades)

Fixture de productor con la jerarquía real v3. Se genera con
`buildV3Release` desde `lib/content/x03-fixtures.ts`; la prueba
`lib/content/x03.test.ts` lo recompone y verifica jerarquía, orden y hash.

## Política

- UTF-8 sin BOM, saltos LF.
- SHA-256 sobre bytes UTF-8 con CRLF normalizado a LF.
- No contiene datos reales de alumnos.

## Archivos

| Archivo | Propósito | SHA-256 |
|---|---|---|
| `manifest-topics.json` | Release v3 con 1 unidad, 1 subtema, 2 lecciones, 2 ejemplos, 2 ejercicios y 2 evaluaciones con preguntas y `exerciseIds` | `17abcf475f6dac8886da1df32388f8a76b7db9c25235bfc2a5404d96dd1c6e69` |

## Uso desde MLO

Copiar a `src/shared/services/content/remote/__fixtures__/v3/x03/` y verificar el
hash con normalización CRLF→LF. Es el cuerpo del manifiesto v3 autorizado, no la
respuesta de la lista de cursos.
