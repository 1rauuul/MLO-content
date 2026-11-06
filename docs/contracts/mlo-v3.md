# Contrato de contenido CMS → MLO v3

- **Versión del contrato:** `3` (`schemaVersion: 3`, entero)
- **Productor:** CMS (`mlo-teachers`)
- **Consumidor:** MLO (`MLO-Ingenieria-software`)
- **Estado:** especificación cerrada; los endpoints `/api/mlo/v3/**` se implementan en X-02
- **Fixtures:** [`docs/contracts/fixtures/`](./fixtures/README.md)
- **Validador:** [`lib/content/contract-v3.ts`](../../lib/content/contract-v3.ts)

Este documento fija la forma de los releases v3. No describe endpoints, esquema
de base de datos ni migraciones de datos. v2 sigue vigente y no se modifica.

## 1. Versión y política de cambio

`schemaVersion` es un entero y vale exactamente `3`. Un consumidor que no
reconozca el valor rechaza el release completo y conserva su copia anterior
(R-X-01-2).

Se considera **cambio aditivo** dentro de v3:

- agregar un campo opcional a un recurso existente;
- agregar un recurso nuevo que los consumidores puedan ignorar;
- agregar valores nuevos a un campo abierto, nunca a un enum cerrado.

Los consumidores deben ignorar campos desconocidos. Un campo desconocido no
altera el hash de lección ni exime de validar el resto.

Obligan a **v4**:

- cambiar el significado, el tipo o la obligatoriedad de un campo existente;
- quitar o renombrar un recurso, campo o enum cerrado;
- cambiar la jerarquía, la composición del grupo, el algoritmo de hash o las
  reglas de identidad;
- cambiar la forma de `schemaVersion` o `kind`.

Cada release publica `version` (entero creciente) y `hash`. Un consumidor
rechaza una versión menor o igual con hash distinto, y trata versión y hash
iguales como «sin cambios». v2 y v3 conviven: el consumidor elige el validador
por `schemaVersion` y no mezcla payloads de versiones distintas.

## 2. Envoltorio común

Todo release v3 es un objeto JSON con estos campos:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `schemaVersion` | entero | Sí | Exactamente `3`. |
| `kind` | string | Sí | `course` o `group`. |
| `catalogId` | string | Sí | Catálogo estable. Curso y grupo del mismo curso comparten este valor. |
| `releaseId` | string | Sí | Identificador único e inmutable del release. |
| `version` | entero | Sí | `>= 1`, creciente por catálogo/grupo. |
| `publishedAt` | string | Sí | ISO-8601 UTC con sufijo `Z`. |
| `hash` | string | Sí | SHA-256 en hex minúsculas del release. |
| `references` | array | Sí | Referencias del release; puede ser `[]`. |
| `notices` | array | Sí | Avisos del release; puede ser `[]`. |

Los campos propios de cada `kind` se describen en las secciones 3 y 6.

### 2.1 JSON canónico y hash del release

Se reutiliza la canonicalización de `lib/content/hash.ts` (DEC-01):

- claves de objeto ordenadas lexicográficamente;
- orden de los arreglos conservado;
- valores `undefined` omitidos (no aparecen en JSON);
- sin espacios insignificantes.

`hash` es el SHA-256 en hex minúsculas de los bytes UTF-8 del JSON canónico del
release **sin el campo `hash`**. Cubre todos los demás campos, incluidas
referencias, avisos y hashes de lección.

### 2.2 Hash por lección

Cada lección propia de un release publica `lesson.hash`. Se calcula sobre el
JSON canónico de:

```json
{
  "lesson": { "...": "objeto lesson sin su campo hash" },
  "evaluation": { "...": "evaluación completa de la lección, o null" },
  "questions": [ "..." ],
  "exercises": [ "..." ],
  "examples": [ "..." ]
}
```

- `questions`: las preguntas de esa evaluación, en el orden del release.
- `exercises` y `examples`: los de esa lección, en el orden del release.
- `evaluation` es el objeto completo de la evaluación (incluye `questionIds` y
  `exerciseIds`) o `null`.

El hash de lección detecta cambios dentro de una lección sin depender del
release completo. El hash del release detecta cualquier cambio del conjunto.

Las actividades que un release de grupo adjunta a una lección del curso no
tienen hash de lección: la lección externa conserva el hash de su release de
curso y las adiciones quedan cubiertas por el hash del release de grupo.

### 2.3 Archivos y fixtures

Los JSON se guardan en UTF-8 sin BOM y con saltos LF. El hash de archivo se
calcula sobre los bytes UTF-8 **normalizando CRLF a LF**, porque ambos repos
usan `core.autocrlf=true`. El manifiesto
[`fixtures.sha256.json`](./fixtures/fixtures.sha256.json) contiene el SHA-256 de
cada fixture y un hash agregado; su política y valores están en el
[README de fixtures](./fixtures/README.md).

## 3. Recursos del curso

Un release de curso tiene `kind: "course"` y añade:

> Los recursos de esta sección son compartidos: el release de grupo usa la misma
> forma para sus propios recursos (sección 6). Cuando una regla de referencia
> habla de «debe existir», en grupo puede tratarse de un recurso del curso; esas
> excepciones están en 6.1.

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `courseId` | string | Sí | Identidad estable del curso dentro de `catalogId`. |
| `baseRef` | objeto o `null` | Sí | Referencia al contenido base resuelta al publicar. |
| `course` | objeto | Sí | Datos visibles del curso. |
| `units` | array | Sí | Unidades ordenadas; puede ser `[]`. |
| `topics` | array | Sí | Subtemas; puede ser `[]`. |
| `lessons` | array | Sí | Lecciones; puede ser `[]`. |
| `evaluations` | array | Sí | Evaluaciones; puede ser `[]`. |
| `questions` | array | Sí | Preguntas; puede ser `[]`. |
| `exercises` | array | Sí | Ejercicios; puede ser `[]`. |
| `examples` | array | Sí | Ejemplos independientes; puede ser `[]`. |

Un curso sin unidades, lecciones ni actividades es válido. El consumidor lo
trata como curso vacío y muestra «Este curso aún no tiene contenido publicado».

### 3.1 Curso

`course`:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `title` | string | Sí | No vacío. |
| `description` | string | Sí | Puede ser vacío. |
| `visibility` | string | Sí | `published` o `unpublished`. `draft` no se publica. |

### 3.2 Unidad

```json
{
  "id": "u1",
  "number": 1,
  "title": "Fundamentos",
  "description": "Conceptos iniciales.",
  "difficulty": "Fundamental",
  "color": "blue",
  "position": 0
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `number` | entero | Sí | `>= 1`. Ordena las unidades. |
| `title` | string | Sí | Puede ser vacío. |
| `description` | string | Sí | Puede ser vacío. |
| `difficulty` | string | Sí | `Fundamental`, `Intermedio` o `Avanzado`. |
| `color` | string | Sí | `blue`, `violet` o `green`. |
| `position` | entero | Sí | `>= 0`. Desempata dentro del mismo `number`. |

### 3.3 Subtema

```json
{
  "id": "t1",
  "unitId": "u1",
  "title": "Conceptos",
  "summary": "Qué es el software.",
  "position": 0
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `unitId` | string | Sí | Debe existir en `units`. |
| `title` | string | Sí | No vacío. |
| `summary` | string | No | Puede ser vacío. |
| `position` | entero | Sí | `>= 0`; ordena dentro de la unidad. |

### 3.4 Lección

```json
{
  "id": "l1.1",
  "topicId": "t1",
  "code": "1.1",
  "title": "Desarrollo de software",
  "eyebrow": "Módulo 01 · Lección 01",
  "body": "Resumen de la lección.",
  "content": [{ "type": "p", "text": "Primer párrafo." }],
  "position": 0,
  "hash": "…",
  "referenceIds": ["ref-apa-1"]
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. Estable: no se reutiliza. |
| `topicId` | string | Sí | Debe existir en `topics`. |
| `code` | string | Sí | Número visible; puede ser vacío. No se exige único. |
| `title` | string | Sí | No vacío. |
| `eyebrow` | string | Sí | Puede ser vacío. |
| `body` | string | Sí | Puede ser vacío; respaldo si `content` está vacío. |
| `content` | array | Sí | Bloques de la sección 9.1; puede ser `[]`. |
| `position` | entero | Sí | `>= 0`; ordena dentro del subtema. |
| `hash` | string | Sí | SHA-256 de la sección 2.2. |
| `referenceIds` | string[] | No | Referencias existentes en el release. |

### 3.5 Evaluación

Una lección tiene **como máximo una** evaluación. Puede no tener evaluación.

```json
{
  "id": "ev1.2",
  "lessonId": "l1.2",
  "title": "Evaluación: Trabajo coordinado",
  "description": "Proceso y calidad.",
  "position": 0,
  "questionIds": ["q1.2-1", "q1.2-2"],
  "exerciseIds": ["ord1.2"]
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `lessonId` | string | Sí | Debe existir; una sola evaluación por lección. |
| `title` | string | Sí | No vacío. |
| `description` | string | Sí | Puede ser vacío. |
| `position` | entero | Sí | `>= 0`. |
| `questionIds` | string[] | Sí | No vacío, sin repetidos; cubre **todas** las preguntas de la evaluación. |
| `exerciseIds` | string[] | Sí | Sin repetidos; subconjunto de ejercicios de esa lección. Puede ser `[]`. |
| `referenceIds` | string[] | No | Referencias existentes. |

v3 sustituye los cupos `questionCount` / `exerciseCount` de v2 por listas
explícitas. Un consumidor que necesite cupos los deriva del largo de las listas.
La composición es explícita para que CMS y MLO no dependan de conteos.

### 3.6 Pregunta

```json
{
  "id": "q1.2-1",
  "evaluationId": "ev1.2",
  "type": "mcq",
  "prompt": "¿Qué se hace primero?",
  "options": ["Especificar", "Validar"],
  "answer": 0,
  "config": {},
  "explanation": "Primero se especifica.",
  "position": 0
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `evaluationId` | string | Sí | Debe existir en `evaluations`. |
| `type` | string | Sí | `mcq`, `order`, `fill`, `match` o `crossword`. |
| `prompt` | string | Sí | No vacío. |
| `options` | string[] | Sí | Según tipo (sección 9.3); puede ser `[]`. |
| `answer` | entero | Sí | `>= 0`; índice para `mcq`, `0` en los demás. |
| `config` | objeto | Sí | Según tipo; `{}` para `mcq` y `order`. |
| `explanation` | string | Sí | Puede ser vacío. |
| `position` | entero | Sí | `>= 0`; orden de almacenamiento. |
| `referenceIds` | string[] | No | Referencias existentes. |

Una pregunta sin evaluación no existe: `evaluationId` siempre resuelve. Una
evaluación publicada siempre tiene al menos una pregunta.

### 3.7 Ejercicio

```json
{
  "id": "ord1.2",
  "lessonId": "l1.2",
  "type": "order",
  "prompt": "Ordena las actividades del proceso",
  "instructions": "Usa las flechas para ordenar.",
  "correctOrder": ["Especificar", "Desarrollar", "Validar"],
  "config": {},
  "explanation": "El proceso va de especificación a validación.",
  "example": {
    "title": "Actividades del proceso",
    "steps": [
      { "text": "Especificar el problema", "why": "Fija el alcance." }
    ],
    "hints": ["Piensa qué ocurre antes de escribir código."]
  },
  "position": 0
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `lessonId` | string | Sí | Debe existir en `lessons`. |
| `type` | string | Sí | `order`, `fill`, `match` o `crossword`. `mcq` no es ejercicio. |
| `prompt` | string | Sí | No vacío. |
| `instructions` | string | Sí | Puede ser vacío. |
| `correctOrder` | string[] | Sí | Para `order`, secuencia válida; para los demás, `[]`. |
| `config` | objeto | Sí | Según tipo (sección 9.2); `{}` para `order`. |
| `explanation` | string | Sí | Puede ser vacío. |
| `example` | objeto o `null` | Sí | Ejemplo embebido de la sección 9.4. |
| `position` | entero | Sí | `>= 0`. |
| `referenceIds` | string[] | No | Referencias existentes. |

### 3.8 Ejemplo independiente

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `lessonId` | string | Sí | Debe existir en `lessons`. |
| `type` | string | Sí | `fill`, `match` o `crossword`. Un ejemplo de `order` va embebido en un ejercicio. |
| `title` | string | Sí | No vacío. |
| `prompt` | string | Sí | No vacío. |
| `config` | objeto | Sí | Según tipo (sección 9.2). |
| `steps` | array | Sí | Al menos un paso con `text` y `why` no vacíos. |
| `hints` | string[] | Sí | Puede ser `[]`. |
| `explanation` | string | Sí | Puede ser vacío. |
| `position` | entero | Sí | `>= 0`. |
| `referenceIds` | string[] | No | Referencias existentes. |

### 3.9 Referencia

```json
{
  "id": "ref-apa-1",
  "text": "Sommerville, I. (2016). Software Engineering (10.ª ed.). Pearson.",
  "url": "https://example.org/sommerville"
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `text` | string | Sí | No vacío; texto APA 7. No es bloque de enlace. |
| `url` | string | No | Dato textual, no multimedia. |

`referenceIds` en lecciones y actividades debe resolver a una referencia del
release. La política de a qué elementos se adjuntan y cómo se deduplican sigue
abierta en DEC-07; v3 permite adjuntarlas a lección, evaluación, pregunta,
ejercicio y ejemplo sin fijar aún la política de producto.

### 3.10 Aviso

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `id` | string | Sí | Único en el catálogo. |
| `title` | string | Sí | No vacío. |
| `body` | string | Sí | No vacío. |
| `publishedAt` | string | No | ISO-8601 UTC. |
| `active` | booleano | Sí | `false` retira el aviso. |

El transporte de avisos (SSE, WebSocket u otro) sigue abierto en DEC-09. v3
solo fija el payload; el aviso no sustituye la sincronización de contenido.

## 4. Jerarquía y orden

```
curso
└── unidad (number, position)
    └── subtema (position)
        └── lección (position, code)
            ├── bloques
            ├── ejercicios (position)
            ├── ejemplos (position)
            └── evaluación (0 o 1)
                ├── preguntas (position)
                └── exerciseIds → ejercicios de la lección
```

Un release de grupo puede:

- crear su propia jerarquía con los mismos recursos (unidad → subtema →
  lección → actividades y evaluación);
- referenciar unidades, subtemas y lecciones del release de curso;
- añadir bloques al final de una lección existente mediante `additions[]`.

Orden de presentación:

1. Unidades: `number`, luego `position`, luego `id`.
2. Subtemas: `position`, luego `id`.
3. Lecciones: `position`, luego `code`, luego `id`.
4. Ejercicios y ejemplos: `position`, luego `id`.
5. Preguntas: `position`, luego `id` (el consumidor puede barajar al mostrar).
6. Referencias y avisos: sin orden contractual; el consumidor decide.
7. `additions[]`: orden del arreglo; sus bloques van después del contenido de
   la lección existente.
8. Composición de grupo: primero el release de curso y después el del grupo. Los
   recursos propios del grupo usan los mismos campos de orden; en empate van
   después de los del curso y, entre sí, por `id`.

No se exige que `position` sea único; el desempate por `id` garantiza un orden
determinista.

## 5. Referencia opcional al contenido base

`baseRef` es obligatorio en el release de curso y vale `null` cuando el curso no
referencia contenido base:

```json
{
  "catalogId": "base",
  "version": 7,
  "hash": "0dd107f18a53cc73a5a9f834150462c30050e0b63110689b20711613042d323d"
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `catalogId` | string | Sí | Catálogo base referenciado. |
| `version` | entero | Sí | Versión del release base resuelta al publicar. |
| `hash` | string | Sí | Hash del release base resuelto. |

- La referencia se resuelve **al publicar**. El release queda fijado a la
  versión y hash registrados y no cambia cuando aparece un release base nuevo.
  Una publicación posterior del curso vuelve a resolver la versión vigente en
  ese momento.
- El grupo no declara `baseRef`. Hereda la referencia del release de curso que
  referencia en `courseRef`; el `baseRef` registrado allí es el que aplica.
- Si el release base no existe, no coincide con el hash esperado o no puede
  resolverse, la publicación falla. No se publica una referencia rota.
- Un curso base sin grupo queda fuera de X-01 (DEC-02).

## 6. Contenido de grupo y composición

Un release de grupo tiene `kind: "group"` y usa el mismo envoltorio que el
curso. Añade estos campos:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `groupId` | string | Sí | Identidad estable del grupo. |
| `courseRef` | objeto | Sí | Release de curso sobre el que se compone. |
| `group` | objeto | Sí | Datos visibles del grupo. |
| `units` | array | Sí | Unidades propias; puede ser `[]`. |
| `topics` | array | Sí | Subtemas propios; puede ser `[]`. |
| `lessons` | array | Sí | Lecciones propias; puede ser `[]`. |
| `evaluations` | array | Sí | Evaluaciones propias; puede ser `[]`. |
| `questions` | array | Sí | Preguntas propias; puede ser `[]`. |
| `exercises` | array | Sí | Ejercicios propios; puede ser `[]`. |
| `examples` | array | Sí | Ejemplos propios; puede ser `[]`. |
| `additions` | array | Sí | Bloques añadidos a lecciones existentes; puede ser `[]`. |

`courseRef`:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `version` | entero | Sí | Versión del release de curso referenciado. |
| `hash` | string | Sí | Hash de ese release de curso. |

El `catalogId` del release de grupo es el mismo del curso; por eso los ids de
ambos comparten espacio. El servidor resuelve `courseRef` y `baseRef` al
componer (X-02).

`group`:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `name` | string | Sí | No vacío. |
| `visibility` | string | Sí | `published` o `unpublished`. `archived` se representa como `unpublished`. |

Los arreglos `units`, `topics`, `lessons`, `evaluations`, `questions`,
`exercises` y `examples` tienen **la misma forma que en el release de curso**
(sección 3). Son contenido propio del grupo: ids nuevos, hashes de lección para
las lecciones propias y composición explícita de evaluaciones.

`additions[]`:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `lessonId` | string | Sí | Lección del release de curso (`courseRef`), nunca una lección propia del grupo. El servidor valida que exista. No se repite entre adiciones. |
| `blocks` | array | Sí | Bloques que se agregan después del contenido de esa lección. |

Una adición **solo** contiene `lessonId` y `blocks`. Incluir `exercises` o
`examples` dentro de una adición invalida el release: esos recursos van en los
arreglos superiores con su `lessonId`. Si los bloques pertenecen a una lección
propia del grupo, van directamente en el `content` de esa lección; el validador
rechaza una adición cuyo `lessonId` coincida con una lección de `lessons[]` del
grupo.

### 6.1 Reglas de referencia entre ámbitos

El validador de esquema no puede consultar el release de curso. Por eso acepta
referencias externas y el servidor las valida al componer (X-02):

| Campo | Referencia válida |
|---|---|
| `topics[].unitId` | Una unidad de `units[]` del grupo **o** una unidad del curso. |
| `lessons[].topicId` | Un subtema de `topics[]` del grupo **o** un subtema del curso. |
| `evaluations[].lessonId` | Una lección de `lessons[]` del grupo **o** una lección del curso. |
| `questions[].evaluationId` | **Siempre** una evaluación de `evaluations[]` del grupo. El grupo no agrega preguntas a evaluaciones del curso. |
| `exercises[].lessonId` | Una lección de `lessons[]` del grupo **o** una lección del curso. |
| `examples[].lessonId` | Una lección de `lessons[]` del grupo **o** una lección del curso. |
| `evaluations[].questionIds` | Solo preguntas de `questions[]` del grupo. |
| `evaluations[].exerciseIds` | Solo ejercicios de `exercises[]` del grupo, de la misma lección. |

Los ids de los recursos propios del grupo son nuevos y no pueden repetir ids del
curso. Esa comprobación entre releases queda para el servidor (X-02); el
validador solo detecta duplicados dentro del release.

Los hashes de lección se calculan **solo para las lecciones propias del grupo**
(`lessons[]`), con la fórmula de 2.2. Las evaluaciones y actividades que el
grupo adjunta a una lección del curso no tienen hash de lección propio: quedan
cubiertas por el hash del release.

### 6.2 Reglas de composición

1. El release de grupo se compone **después** del release de curso que
   referencia; nunca antes ni contra «la última versión».
2. El grupo puede crear su propia jerarquía completa y también adjuntar
   actividades a lecciones del curso. No reemplaza ni reescribe contenido del
   curso.
3. `additions[]` solo apunta a lecciones del release de curso. Si los bloques
   son para una lección propia, van en su `content`; una adición cuyo `lessonId`
   coincida con una lección de `lessons[]` del grupo invalida el release.
4. Los ids propios son nuevos y únicos en el catálogo. Un id existente con
   contenido distinto se rechaza al publicar (DEC-04).
5. Las referencias externas (`unitId`, `topicId`, `lessonId`) deben resolverse
   en el release de curso referenciado. Si no existen, la publicación falla en el
   servidor.
6. Orden visible: primero el contenido del curso y después el del grupo. Los
   bloques de `additions[]` van al final de su lección; los ejercicios y ejemplos
   del grupo se ordenan con los del curso por `position` y, en empate, después de
   los del curso.
7. Referencias y avisos de ambos releases se unen sin duplicar por id; el id es
   el del espacio global del catálogo.
8. La autorización de publicación se valida en el servidor (DEC-04); el
   contrato no confía en la UI.
9. Despublicar el grupo (`visibility: "unpublished"`) oculta su jerarquía y sus
   adiciones; el contenido del curso permanece.

## 7. Visibilidad y despublicación

| Estado | Efecto |
|---|---|
| `course.visibility: "published"` | El curso y su contenido pueden mostrarse. |
| `course.visibility: "unpublished"` | El consumidor oculta el curso tras sincronizar. Sin red conserva la última copia. |
| `group.visibility: "published"` | La jerarquía propia del grupo y sus adiciones pueden mostrarse. |
| `group.visibility: "unpublished"` | El consumidor oculta el contenido propio del grupo y sus adiciones tras sincronizar. |

`draft` es un estado interno de CMS y no se publica como release. Un release
`unpublished` sigue siendo estructuralmente válido y verificable por hash; no es
un documento vacío ni un borrado.

Si el consumidor rechaza una actualización por versión, identidad, hash o
estructura incompatible, conserva la copia anterior y no aplica cambios
parciales (R-X-01-2). La aplicación es todo-o-nada, igual que en v2.

## 8. IDs y unicidad

- Los ids son strings no vacíos, estables e inmutables. No se reutilizan aunque
  el recurso se elimine.
- Todos los recursos del catálogo comparten **un solo espacio de ids**: unidades,
  subtemas, lecciones, evaluaciones, preguntas, ejercicios, ejemplos,
  referencias y avisos. Un id repetido invalida el release.
- El curso y sus grupos comparten el `catalogId` y, por tanto, el espacio de ids.
- Un id existente con contenido distinto se rechaza al publicar. Mismo id y
  mismo contenido es una publicación idempotente. Esta comprobación entre
  releases es responsabilidad del servidor (X-02); el validador de esquema solo
  detecta duplicados dentro de un release.
- No se permite que un grupo reemplace contenido del curso usando su id.
- El `hash` de lección y el del release permiten detectar contenido distinto
  bajo la misma identidad.

### 8.1 Migración v2 → v3 y compatibilidad de ids

La migración de datos (X-03) es explícita y reversible. Para no romper
`attempts` ni `evaluation_results`, se conservan los ids v2:

| v2 | v3 |
|---|---|
| `unit.content_id` | `unit.id` (mismo valor). |
| Lección v2 (que operaba como subtema) | Subtema nuevo + primera lección con **el mismo id** de la lección v2. El subtema recibe un id nuevo y único. |
| `evaluation.content_id` | `evaluation.id` (mismo valor). |
| `question.content_id` | `question.id` (mismo valor). |
| `exercise.content_id` / `example.content_id` | Mismos ids. |
| `class.id` | `groupId` (mismo valor). |
| Extra de clase tipo `lesson` | `additions[].blocks` (los bloques no llevan id). |
| Extra de clase tipo `exercise` | `exercises[]` con `lessonId` del extra y el mismo `extra.id`. |
| Extra de clase tipo `example` | `examples[]` con `lessonId` del extra y el mismo `extra.id`. |
| `question_count` / `exercise_count` | Se sustituyen por `questionIds` / `exerciseIds` construidos con el contenido existente. |

La vuelta atrás consiste en seguir sirviendo el release v2: no se borran filas
v2 ni se reescriben ids. El subtema nuevo es aditivo. Los detalles de ejecución
pertenecen a X-03.

## 9. Reglas de las actividades

Estas reglas reproducen el comportamiento real del consumidor descrito en
`docs/api/contrato-contenido-cms.md` de MLO. Un release que las incumpla se
rechaza completo.

### 9.1 Bloques de contenido

Solo existen cinco tipos. Un tipo desconocido invalida la lección.

```json
{ "type": "p", "text": "Párrafo" }
{ "type": "h", "text": "Subtítulo" }
{ "type": "bullets", "items": ["Punto A", "Punto B"] }
{ "type": "numbers", "items": ["Paso 1", "Paso 2"] }
{ "type": "table", "header": ["Concepto", "Definición"], "rows": [["A", "B"]] }
```

- `p` y `h`: `text` no vacío.
- `bullets` y `numbers`: `items` es `string[]` no vacío, sin elementos vacíos.
- `table`: `header` es `string[]` no vacío; `rows` es `string[][]` no vacío; cada
  fila tiene exactamente la misma cantidad de celdas que el encabezado y
  ninguna celda vacía.
- No hay bloques de imagen ni de enlace.

### 9.2 Ejercicios y ejemplos

| Tipo | Reglas |
|---|---|
| `order` | `correctOrder` con al menos 2 elementos, ninguno vacío y sin repetidos. `config` es `{}`. |
| `fill` | `config.sentences` es `string[]` no vacío; cada oración contiene al menos un hueco `{{respuesta}}` no vacío. `config.bank` es `string[]` (puede contener distractores). La respuesta se extrae del texto. |
| `match` | `config.pairs` con al menos 2 pares; `left` y `right` no vacíos; no se repite ningún `left` ni ningún `right`. |
| `crossword` | `config.crossword.rows` y `cols` enteros `>= 1`; al menos una entrada; `word` solo `A-Z` y `Ñ`; `clue` no vacío; `direction` `across` o `down`; la palabra cabe en la cuadrícula; las celdas compartidas tienen la misma letra. `config.bank` es opcional. |

Un ejemplo independiente usa `fill`, `match` o `crossword` con la misma
configuración. Un ejemplo de `order` se expresa dentro de `exercises[].example`.
El consumidor no valida el `config` de los ejemplos por su cuenta: el CMS debe
enviarlo correcto.

### 9.3 Preguntas de evaluación

| Tipo | `options` | `answer` | Verdad |
|---|---|---|---|
| `mcq` | Al menos 2 opciones no vacías y únicas. | Índice 0-based dentro de `options`. | `options[answer]`. |
| `order` | Secuencia correcta con al menos 2 elementos, sin vacíos ni repetidos. | `0`. | El orden de `options`. |
| `fill` | `[]`. | `0`. | `config.sentences` con huecos `{{…}}` y `config.bank`. |
| `match` | `[]`. | `0`. | `config.pairs` con las reglas de 9.2. |
| `crossword` | `[]`. | `0`. | `config.crossword` con las reglas de 9.2. |

`mcq` solo existe como pregunta; no es un tipo de ejercicio.

### 9.4 Ejemplo embebido

| Campo | Regla |
|---|---|
| `title` | No vacío. |
| `steps` | Al menos un paso; `text` y `why` no vacíos. |
| `hints` | `string[]`; puede ser `[]` o faltar. |

El campo `example` del ejercicio es **obligatorio**: un objeto o `null`. Omitirlo
invalida el release. El ejemplo embebido hereda del ejercicio su identidad, tipo,
enunciado, configuración y explicación.

### 9.5 Evaluación

- Una lección tiene cero o una evaluación.
- Si hay evaluación, `questionIds` no está vacío y contiene exactamente las
  preguntas cuyo `evaluationId` apunta a ella.
- `exerciseIds` solo referencia ejercicios de la misma lección y puede ser `[]`.
- Una lección sin evaluación no tiene preguntas.
- En un release de grupo, la pregunta solo puede apuntar a una evaluación del
  propio grupo; nunca a una evaluación del curso.
- El consumidor puede barajar preguntas, opciones y ejercicios al mostrar; el
  orden contractual es el de almacenamiento.

## 10. Compatibilidad con v2

- v2 (`schemaVersion: 2`) sigue publicado sin cambios: manifiesto, payload de
  lección, release de clase y endpoints `/api/mlo/v2/**`.
- v3 no reutiliza ni reinterpreta payloads v2. El consumidor elige el validador
  por `schemaVersion` y rechaza cualquier otro valor.
- La canonicalización de hash es la misma utilidad en ambos lados, pero el
  alcance del hash v3 (release completo y lección con evaluación y actividades)
  es propio de v3.
- v3 no implementa endpoints todavía. X-02 define las rutas `/api/mlo/v3/**`;
  hasta entonces v2 es la única ruta servida.
- Los ids migrados se conservan para que `attempts` y `evaluation_results`
  sigan apuntando al mismo elemento (DEC-03).
- La migración es reversible: el release v2 permanece intacto y sirve como
  rollback mientras no se retire.

### 10.1 Correspondencia de campos v2 → v3

| v2 | v3 |
|---|---|
| `manifest.lessons[].lessonId` | `lessons[].id` |
| `manifest.lessons[].unitId` | `lessons[].topicId` (subtema de la lección) |
| `payload.unit` | `units[]` (una sola vez, ya no repetida por lección) |
| `payload.lesson` | `lessons[]` |
| `payload.evaluation` + `questions[]` | `evaluations[]` + `questions[]` |
| `payload.exercises[]` | `exercises[]` |
| `payload.examples[]` | `examples[]` |
| `payload.hash` | `lessons[].hash` |
| `manifest.hash` | release `hash` |
| Release de clase (`class`, `lessons[].extras`) | Release de grupo (`group`, `additions[]` y arreglos propios) |
| `questionCount` / `exerciseCount` | `questionIds` / `exerciseIds` |

## 11. Validación y fixtures

Comando de verificación:

```sh
node --import tsx --test lib/content/contract-v3.test.ts
```

El validador `validateRelease` es puro: no accede a red, base de datos ni lógica
v2. Devuelve `{ ok: true, release }` o `{ ok: false, error }` con el motivo.

Qué comprueba:

- `schemaVersion`, `kind` y campos obligatorios;
- hashes de release y de cada lección propia;
- unicidad de ids en todo el catálogo;
- jerarquía y referencias internas del release;
- referencias externas del grupo solo en su forma: `unitId`, `topicId` y
  `lessonId` pueden apuntar fuera del release; `evaluationId` de una pregunta
  siempre debe existir en el grupo;
- `additions[]` solo con `lessonId` y `blocks`; rechaza ejercicios o ejemplos
  dentro de una adición y adiciones sobre lecciones propias del grupo;
- presencia obligatoria de `example` en cada ejercicio (objeto o `null`);
- reglas de bloques, ejercicios, ejemplos y preguntas;
- composición explícita de evaluaciones.

Qué **no** comprueba, porque requiere el servidor o el release referenciado:

- que `baseRef` y `courseRef` existan y coincidan;
- que las referencias externas del grupo (`unitId`, `topicId`, `lessonId`)
  existan en el release de curso;
- que el `lessonId` de una adición exista en el release de curso;
- que un id de grupo no reutilice un id del curso;
- autorización del docente;
- versión monotónica frente al release almacenado.

Fixtures: tres válidos (curso vacío, curso con `baseRef`, grupo con jerarquía y
actividades propias más una adición de bloques a una lección del curso) y cinco
inválidos (versión, id duplicado, hash alterado, jerarquía rota, actividad
inválida). La prueba amplía los casos de grupo en memoria: pregunta sobre
evaluación del curso, `additions` con ejercicios/ejemplos, adición sobre una
lección propia, ejercicio sin `example` y hash de lección de grupo alterado.

Los hashes están en [`fixtures.sha256.json`](./fixtures/fixtures.sha256.json) y
el detalle en el [README de fixtures](./fixtures/README.md).

Hash agregado de los ocho fixtures:

```
ee48d0412722756454423690184cbb3ea1f57a8dbdba1faae49a8821fbcc999c
```

## 12. Pendientes fuera de X-01

- **X-02:** endpoints `/api/mlo/v3/**`, resolución de `baseRef` / `courseRef`,
  referencias externas del grupo, autorización de servidor, comprobación de id
  con contenido distinto entre releases y versión monotónica.
- **DEC-05:** acceso controlado en producción.
- **DEC-07:** alcance de referencias y deduplicación.
- **DEC-09:** transporte de avisos.
- **X-03:** migración de datos y evaluación por lección.
- **X-04:** composición ampliada de grupos (jerarquía propia, referencias al
  curso y autorización) en producción.
