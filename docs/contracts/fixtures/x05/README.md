# Fixtures · X-05 (bibliografía APA 7)

Release v3 de curso con referencias estructuradas publicadas como texto APA 7.
Se genera con `buildV3Release` desde `lib/content/x05-fixtures.ts`; la prueba
`lib/content/x05.test.ts` recompone el archivo y falla si diverge.

## Política

- UTF-8 sin BOM, saltos LF.
- SHA-256 sobre bytes UTF-8 con CRLF normalizado a LF.
- Sin datos reales de alumnos.
- El payload conserva `{id, text, url?}`; autores, año, edición y DOI no salen
  al contrato (DEC-07).

## Archivos

| Archivo | Propósito | SHA-256 |
|---|---|---|
| `references-release.json` | Curso v3 con 1 unidad, 1 subtema, 1 lección, 1 evaluación, 1 pregunta, 1 ejercicio y 1 ejemplo; referencias adjuntas a los cinco tipos, con autores, DOI y ausencia de fecha | `2c6355a639ec34f264e2b608ac72bf185e89e317f0dff8f6ecc80cccb1aa4d3f` |

El fixture incluye `ref-apa-3` sin adjuntar a ningún elemento: no aparece en
`references[]`, lo que demuestra que solo se publican referencias de contenido
visible. `ref-apa-1` se adjunta a varios elementos y se deduplica por `id`.

## Uso desde MLO

Copiar a `src/shared/services/content/remote/__fixtures__/v3/x05/` y verificar
el hash con normalización CRLF→LF. El consumidor consolida las referencias de
los elementos visibles, ordena y deduplica por `id` conservando la primera.
