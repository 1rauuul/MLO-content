# Fixtures · contrato MLO v3

Fixtures canónicos del contrato [mlo-v3](../mlo-v3.md) (`schemaVersion: 3`).
CMS es el productor; MLO los copia íntegros para pruebas de paridad.

## Contrato y política de saltos de línea

- Contrato: `mlo-v3`
- `schemaVersion`: `3` (entero)
- Algoritmo de archivo: SHA-256 sobre los bytes UTF-8 del archivo, **normalizando CRLF a LF antes de calcular**.
- Los archivos se guardan en UTF-8 **sin BOM** y con saltos **LF**.
- Ambos repos usan `core.autocrlf=true`, de modo que un checkout en Windows puede materializar CRLF. La normalización hace que el hash sea idéntico en cualquier plataforma.
- `aggregate` es el SHA-256 del JSON canónico del mapa `files` (claves ordenadas, mismo algoritmo del contrato).

## Archivos

| Archivo | Propósito | Resultado esperado |
|---|---|---|
| `valid-course-empty.json` | Curso publicado sin unidades ni contenido | Pasa |
| `valid-course-base-ref.json` | Curso con 1 unidad, 1 subtema, 2 lecciones, 2 ejemplos, 2 ejercicios, 2 evaluaciones con preguntas y `baseRef` a `base` | Pasa |
| `valid-group-content.json` | Release de grupo con unidad y subtema propios, sus cuatro colecciones, recursos sobre un subtema del curso y una adición de bloques a una lección del curso | Pasa |
| `invalid-version.json` | `schemaVersion: 4` | Falla: versión incompatible |
| `invalid-duplicate-id.json` | Unidad `u1` repetida | Falla: id duplicado |
| `invalid-hash.json` | `hash` del release alterado | Falla: hash del release no coincide |
| `invalid-hierarchy.json` | Lección apunta a un subtema inexistente | Falla: subtema inexistente |
| `invalid-activity.json` | Pregunta `mcq` con `answer` fuera de rango | Falla: respuesta fuera de rango |

Los cinco inválidos derivan de `valid-course-base-ref.json` y solo introducen el
defecto indicado; sus hashes internos se recalcularon para que el motivo de
rechazo sea el esperado.

## SHA-256 por archivo

| Archivo | SHA-256 |
|---|---|
| `invalid-activity.json` | `4aec932fcad97da49eac1a5d57956bbf0b3f59752810da08fd8d3c0b0f0992cd` |
| `invalid-duplicate-id.json` | `23b3c17e83a1c212eea830103de602423d8dbbcfebb05d8eef6dd534211ed055` |
| `invalid-hash.json` | `edb9b5330bc86543f311296e1334a7978b90464f05c3912db9d053a74ea05622` |
| `invalid-hierarchy.json` | `a94fe811d7b9253944b37fde1286bcc2f1a559d013c5cd304ea88a84526db413` |
| `invalid-version.json` | `89659f6e4a70c862316fbda0548235a9d23c2065967aa966e878377649dd89dd` |
| `valid-course-base-ref.json` | `43438502451ef142c4fb92d3d4a9a5ed1131007588224940ad440bee00270095` |
| `valid-course-empty.json` | `effbe6a0276748824f10e5df850b8ee97da5b632eb8d4fbac6d80a709c8f7438` |
| `valid-group-content.json` | `9a4093dedd029db3a44aed992e0aab8f0c27add6e3f84aff719d920da9994b46` |

Hash agregado:

```
ef7ef257fa0b898c5c8d54d161426780aa4e80b7036c544ed3befbfb0d85ce8b
```

La lista completa y verificable está en [`fixtures.sha256.json`](./fixtures.sha256.json).

## Verificación

```sh
node --import tsx --test lib/content/contract-v3.test.ts
```

La prueba comprueba: válidos pasan, inválidos fallan por el motivo documentado,
LF sin BOM, SHA-256 por archivo y hash agregado, y que el manifiesto no omite ni
agrega fixtures.

## Uso desde MLO

Copiar los ocho archivos de datos y `fixtures.sha256.json` a
`src/shared/services/content/remote/__fixtures__/v3/` sin editarlos. Verificar
los hashes con la misma normalización CRLF→LF. Cualquier cambio de contenido en
CMS obliga a regenerar los hashes y a versionar el contrato antes de sincronizar.
