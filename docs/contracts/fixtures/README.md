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
| `valid-course-base-ref.json` | Curso con jerarquía completa y `baseRef` a `base` | Pasa |
| `valid-group-content.json` | Release de grupo con unidad, subtema, lección, evaluación, pregunta, ejercicio, ejemplo y bloques añadidos a una lección del curso | Pasa |
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
| `invalid-activity.json` | `5d248f2d833b7088a13ba390e503c2823baa9e5b0633fb8f38f6ab4c62d0477a` |
| `invalid-duplicate-id.json` | `f721c922e3ab9746157ea2334c221ee8c56684437a7aa6e797a55f6aaee99384` |
| `invalid-hash.json` | `508d10866ea280de427ef72c12d9c1d4ad03e7612963bd1c5c8ef84a1a0181b4` |
| `invalid-hierarchy.json` | `422f591aab248764c54e7ac1117f9b52516283cd838ff9f8150ef62e4d835980` |
| `invalid-version.json` | `1b9401c45ad2b2713cf0237ab0fb6f336f0938af57020a5ad34bf254616644c0` |
| `valid-course-base-ref.json` | `c76b52d56b37fb8d21e40004397e27c713566bc8dfee7cc21458572549ea7e8c` |
| `valid-course-empty.json` | `effbe6a0276748824f10e5df850b8ee97da5b632eb8d4fbac6d80a709c8f7438` |
| `valid-group-content.json` | `6b1f655d43d5b6c4b6828336fc9d03bdbdf161e44d984e9069b90058ce3f84a7` |

Hash agregado:

```
ee48d0412722756454423690184cbb3ea1f57a8dbdba1faae49a8821fbcc999c
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
