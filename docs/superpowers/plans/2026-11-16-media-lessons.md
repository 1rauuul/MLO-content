# Imágenes y video en lecciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir imágenes (offline) y videos de YouTube (con conexión) en lecciones creadas desde `/contenido-extra`, y que MLO los muestre dentro de la app.

**Architecture:** El CMS guarda imágenes en Postgres y publica URLs firmadas; MLO descarga las imágenes durante la sincronización y las usa desde el sistema de archivos. Los videos solo llevan la URL de YouTube y se reproducen en un WebView dentro de MLO.

**Tech Stack:** Next.js 16 + React 19 + Postgres (`postgres`), node:test; Expo 58 + React Native 0.88 + expo-sqlite + expo-file-system + `react-native-webview`.

**Spec:** `docs/superpowers/specs/2026-11-16-media-lessons-design.md`

## Global Constraints

- Imágenes: máx. 3 MB, `image/jpeg`, `image/png`, `image/webp`; SVG prohibido.
- Compresión en el navegador: lado máximo 1600 px, WebP con respaldo JPEG.
- Video: solo YouTube (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`); ID de 11 caracteres `[A-Za-z0-9_-]`.
- Variables nuevas: `APP_BASE_URL`, `MEDIA_SECRET`.
- Copy exacto del aviso: «Las imágenes se guardan con la lección y se ven sin conexión. Los videos se reproducen en MLO y requieren conexión.»
- Copy exacto del fallback: «Imagen no disponible sin conexión.»
- El curso base no muestra controles multimedia.
- No se agregan dependencias al CMS. En MLO solo `react-native-webview`.
- **No hacer commits en esta pasada:** el worktree tiene cambios ajenos sin confirmar. Dejar el staging al usuario.

## Review Focus

1. Archivo no-imagen o SVG disfrazado de imagen → se rechaza en `POST /api/media` (magic bytes + MIME).
2. Firma alterada o ausente en MLO → `GET /api/media/[id]` responde 404; el maestro autenticado sí puede previsualizar.
3. Publicar sin `APP_BASE_URL` o `MEDIA_SECRET` → error claro antes de guardar el release.
4. Fallo de descarga de una imagen durante la sincronización → la sincronización termina y la lección conserva la URL remota.
5. Bloque desconocido o archivo local borrado en MLO → no rompe el render; muestra texto de respaldo.

---

### Task 1: Modelo y validación de bloques multimedia (CMS)

**Files:**
- Create: `lib/content/media.ts`
- Modify: `lib/content.ts`
- Modify: `lib/content/validate.ts`
- Test: `lib/content/media.test.ts`
- Test: `lib/content.test.ts`
- Modify: `package.json` (agregar el test al script `test`)

**Interfaces:**
- Produces:
  - `IMAGE_MIME_TYPES = ["image/jpeg","image/png","image/webp"] as const`
  - `type ImageMime = (typeof IMAGE_MIME_TYPES)[number]`
  - `mediaSrc(mediaId: string): string` → `/api/media/${mediaId}`
  - `youtubeVideoId(url: string): string | null`
  - `youtubeWatchUrl(videoId: string): string`
  - `youtubeThumbnail(videoId: string): string`
  - `type ImageBlock` y `type VideoBlock` exportados desde `lib/content.ts`.
  - `ContentBlock` gana `image` y `video`.

- [ ] **Step 1: Escribir tests de YouTube y de bloques**

En `lib/content/media.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { youtubeThumbnail, youtubeVideoId, youtubeWatchUrl } from "./media";

test("extrae el id de YouTube de sus cuatro formatos", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ]) {
    assert.equal(youtubeVideoId(url), "dQw4w9WgXcQ");
  }
  assert.equal(youtubeVideoId("https://vimeo.com/123"), null);
  assert.equal(youtubeVideoId("no es una url"), null);
});

test("construye la URL canónica y la miniatura", () => {
  assert.equal(youtubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtubeThumbnail("dQw4w9WgXcQ"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
});
```

En `lib/content.test.ts`, añadir:

```ts
const mediaId = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";

test("acepta imagen y video y normaliza sus campos", () => {
  const result = parseBlocks(JSON.stringify([
    { type: "image", mediaId, mime: "image/webp", width: 1280, height: 720, alt: "Diagrama" },
    { type: "video", url: "https://youtu.be/dQw4w9WgXcQ", title: "Clase" },
  ]));
  assert.ok("blocks" in result);
  assert.equal(result.blocks[0].type, "image");
  assert.equal((result.blocks[0] as { src: string }).src, `/api/media/${mediaId}`);
  assert.equal(result.blocks[1].type, "video");
  assert.equal((result.blocks[1] as { url: string }).url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("rechaza imagen sin alt, MIME no permitido y video no YouTube", () => {
  assert.ok("error" in parseBlocks(JSON.stringify([
    { type: "image", mediaId, mime: "image/webp", width: 1, height: 1, alt: "" },
  ])));
  assert.ok("error" in parseBlocks(JSON.stringify([
    { type: "image", mediaId, mime: "image/svg+xml", width: 1, height: 1, alt: "x" },
  ])));
  assert.ok("error" in parseBlocks(JSON.stringify([
    { type: "video", url: "https://vimeo.com/123", title: "x" },
  ])));
});
```

Cambiar el test de tipo desconocido para usar `{ type: "audio" }` en lugar de `image`.

- [ ] **Step 2: Correr los tests y ver el fallo**

Run: `node --import tsx --test lib/content/media.test.ts lib/content.test.ts`
Expected: FAIL por `youtubeVideoId` inexistente y por bloques desconocidos.

- [ ] **Step 3: Implementar `lib/content/media.ts` y los tipos**

`lib/content/media.ts` exporta las constantes/funciones del bloque **Interfaces**. `youtubeVideoId` acepta `http(s)` y devuelve el ID solo si coincide con `/^[A-Za-z0-9_-]{11}$/`.

En `lib/content.ts`, extender `ContentBlock` y en `parseBlocks`:

- `image`: `mediaId` UUID, `mime` permitido, `width`/`height` enteros entre 1 y 10000, `alt` no vacío (máx. 200), `caption` opcional (máx. 300). Normalizar `src: mediaSrc(mediaId)`. Ignorar el `src` entrante.
- `video`: extraer el ID con `youtubeVideoId`; normalizar `url: youtubeWatchUrl(id)`; `title` no vacío (máx. 120).
- El mensaje cuando solo hay encabezados pasa a: `"Agrega al menos un párrafo, una lista, una tabla, una imagen o un video."`

En `lib/content/validate.ts`, aceptar los dos tipos con las mismas reglas (sin exigir `src` absoluto; el CMS lo genera al publicar).

En `lib/content/contract-v3.ts` (`parseBlocks`), aceptar `image` y `video`; para `image` exigir `src` que empiece por `http://` o `https://`, `mime` permitido, dimensiones positivas y `alt` no vacío; para `video` exigir URL `https://www.youtube.com/watch?v=…` y título no vacío.

- [ ] **Step 4: Correr los tests**

Run: `node --import tsx --test lib/content/media.test.ts lib/content.test.ts lib/content/validate.test.ts lib/content/contract-v3.test.ts`
Expected: PASS.

---

### Task 2: Almacenamiento y endpoints de medios (CMS)

**Files:**
- Create: `supabase/migrations/20261116000001_media.sql`
- Create: `lib/media/image.ts`
- Create: `lib/media/signing.ts`
- Create: `app/api/media/route.ts`
- Create: `app/api/media/[id]/route.ts`
- Test: `lib/media/image.test.ts`
- Test: `lib/media/signing.test.ts`
- Modify: `.env.example`
- Modify: `package.json` (tests nuevos)
- Modify: `DESPLIEGUE-GCLOUD.md`

**Interfaces:**
- Produces:
  - `mediaMime(bytes: Uint8Array): ImageMime | null`
  - `signMediaId(id: string): string`
  - `verifyMediaSignature(id: string, signature: string): boolean`
  - `signedMediaUrl(id: string): string`
  - `appBaseUrl(): string` (lanza si falta en producción)

- [ ] **Step 1: Escribir tests de magic bytes y firma**

```ts
// lib/media/image.test.ts
assert.equal(mediaMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
assert.equal(mediaMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
assert.equal(mediaMime(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
assert.equal(mediaMime(new TextEncoder().encode("<svg></svg>")), null);
```

```ts
// lib/media/signing.test.ts
process.env.MEDIA_SECRET = "test-secret";
process.env.APP_BASE_URL = "https://cms.test";
const url = signedMediaUrl("6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab");
assert.match(url, /^https:\/\/cms\.test\/api\/media\/6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab\?sig=/);
const sig = new URL(url).searchParams.get("sig") ?? "";
assert.equal(verifyMediaSignature("6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab", sig), true);
assert.equal(verifyMediaSignature("otro", sig), false);
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `node --import tsx --test lib/media/image.test.ts lib/media/signing.test.ts`
Expected: FAIL por módulos inexistentes.

- [ ] **Step 3: Implementar migración, helpers y rutas**

Migración `media`:

```sql
create table media (
  id uuid primary key default gen_random_uuid(),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null,
  byte_size integer not null check (byte_size > 0),
  sha256 text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid not null references teachers (id) on delete cascade,
  created_at timestamptz not null default now()
);
```

`lib/media/signing.ts`: HMAC-SHA256 con `MEDIA_SECRET`, `base64url`, comparación con `timingSafeEqual`; `appBaseUrl()` usa `APP_BASE_URL` y en desarrollo hace fallback a `http://localhost:3000`.

`app/api/media/route.ts` (`POST`):
- `getSession()`; si no hay sesión, 401.
- Rechazar si `Origin` existe y su host no coincide con `Host` (403).
- `request.formData()`; `file` debe ser `File`; máx. 3 MB; `mediaMime` debe coincidir con `file.type`; dimensiones enteras del formulario.
- `sha256` con `node:crypto`; si ya existe una fila con ese hash, devolver esa.
- Insertar y devolver `{ id, src: mediaSrc(id), mime, width, height }`.

`app/api/media/[id]/route.ts` (`GET`):
- Validar UUID.
- Autorizar si `verifyMediaSignature(id, sig)` o si hay sesión de maestro; si no, 404.
- Devolver bytes con `Content-Type`, `Content-Length`, `ETag`, `X-Content-Type-Options: nosniff`, `Access-Control-Allow-Origin: *`.
- Firma válida: `Cache-Control: public, max-age=31536000, immutable`; sesión: `private, max-age=0, must-revalidate`.
- Si `If-None-Match` coincide, 304.

Añadir `APP_BASE_URL=` y `MEDIA_SECRET=` a `.env.example`; documentar ambas en `DESPLIEGUE-GCLOUD.md` y que las imágenes viven en Postgres (sin Cloud Storage).

- [ ] **Step 4: Correr tests y typecheck**

Run: `node --import tsx --test lib/media/image.test.ts lib/media/signing.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 3: Publicación de URLs firmadas y contrato

**Files:**
- Create: `lib/content/publish-media.ts`
- Modify: `lib/content/serialize.ts`
- Modify: `lib/content/v3.ts`
- Modify: `lib/content/group-release.ts`
- Test: `lib/content/publish-media.test.ts`
- Modify: `docs/contracts/mlo-v3.md`

**Interfaces:**
- Consumes: `signedMediaUrl`, `ContentBlock`.
- Produces: `publishMediaBlocks(blocks: ContentBlock[]): ContentBlock[]`.

- [ ] **Step 1: Escribir el test de transformación**

```ts
process.env.MEDIA_SECRET = "test-secret";
process.env.APP_BASE_URL = "https://cms.test";
const mediaId = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";
const [block] = publishMediaBlocks([
  { type: "image", mediaId, src: `/api/media/${mediaId}`, mime: "image/webp", width: 10, height: 10, alt: "x" },
]);
assert.equal(block.type, "image");
assert.match((block as { src: string }).src, /^https:\/\/cms\.test\/api\/media\//);
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `node --import tsx --test lib/content/publish-media.test.ts`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar y conectar**

- `publishMediaBlocks` reemplaza `src` de cada imagen por `signedMediaUrl(mediaId)`; deja texto y video igual.
- `serializeLesson` aplica `publishMediaBlocks(lesson.content)`.
- `buildV3Release` aplica `publishMediaBlocks` al `content` de cada lección.
- `buildGroupRelease` aplica `publishMediaBlocks` a `addition.blocks`.
- Actualizar `docs/contracts/mlo-v3.md` §9.1: ahora hay siete tipos; documentar `image` y `video`, la URL firmada y que las imágenes se cachean offline mientras el video requiere conexión. Eliminar «No hay bloques de imagen ni de enlace.»

- [ ] **Step 4: Correr tests del contrato y publicación**

Run: `node --import tsx --test lib/content/publish-media.test.ts lib/content/publish.test.ts lib/content/v3.test.ts lib/content/group-release.test.ts lib/content/contract-v3.test.ts`
Expected: PASS.

---

### Task 4: Editor de lección con imágenes y video (CMS)

**Files:**
- Create: `app/(panel)/cursos/[id]/lecciones/[lessonId]/media-blocks.tsx`
- Create: `app/(panel)/cursos/[id]/lecciones/[lessonId]/media-picker.tsx`
- Modify: `app/(panel)/cursos/[id]/lecciones/[lessonId]/block-editor.tsx`
- Modify: `app/(panel)/cursos/[id]/lecciones/[lessonId]/lesson-editor.tsx`
- Modify: `app/(panel)/cursos/[id]/lecciones/[lessonId]/page.tsx`

**Interfaces:**
- Produces:
  - `htmlFromMediaBlock(block: ImageBlock | VideoBlock): string`
  - `mediaBlockFromFigure(figure: HTMLElement): ImageBlock | VideoBlock | null`
  - `compressImage(file: File): Promise<{ blob: Blob; width: number; height: number; mime: ImageMime }>`
  - `ImagePickerDialog` y `VideoPickerDialog` con props `{ onClose(): void; onInsert(block: ContentBlock): void }`.
- `BlockEditor` gana `allowMedia?: boolean` (default `true`).

- [ ] **Step 1: Implementar helpers de HTML**

`media-blocks.tsx`:
- Serializa imagen como `<figure contenteditable="false" data-block="image" data-media-id="…" data-mime="…" data-width="…" data-height="…" data-alt="…" data-caption="…"><img src="/api/media/<id>" alt="…"><figcaption>…</figcaption><button type="button" data-remove>Quitar</button></figure>`.
- Serializa video como figura con `data-block="video"`, `data-url`, `data-title`, miniatura de YouTube y botón `data-remove`.
- Escapa texto y atributos (`&`, `<`, `>`, `"`).
- `mediaBlockFromFigure` lee los `data-*` y devuelve el bloque; usa `mediaSrc(mediaId)`.

- [ ] **Step 2: Implementar pickers y compresión**

`media-picker.tsx`:
- Imagen: `<input type="file" accept="image/jpeg,image/png,image/webp">`, preview con `URL.createObjectURL`, campos `alt` (obligatorio) y `caption`; comprime con canvas a 1600 px, `toBlob("image/webp", 0.82)` y fallback JPEG; sube a `POST /api/media` con `fetch` y `FormData`; en éxito llama `onInsert` con el bloque.
- Video: campo URL y título; muestra error si `youtubeVideoId` es `null`; llama `onInsert` con `{ type:"video", url: youtubeWatchUrl(id), title }`.
- Ambos ignoran respuestas no-OK y muestran un `role="alert"`.

- [ ] **Step 3: Conectar en `BlockEditor`**

- Botones «Imagen» y «Video» junto a las herramientas de formato cuando `allowMedia`.
- Guardar el `Range` de selección antes de abrir el picker; al insertar, restaurar el rango en el editor y usar `document.execCommand("insertHTML", false, html)`; si no hay rango, insertar al final.
- Parsear `FIGURE` antes que cualquier otro nodo en `blocksFromNode`.
- Delegar el click de `[data-remove]` para eliminar la figura y sincronizar.
- Añadir el aviso exacto de `Global Constraints` debajo de la barra de herramientas.
- `LessonEditor` recibe `allowMedia` y pasa `allowMedia={!lesson.is_base}` desde `page.tsx`; `ContentStudio` no cambia (default `true`).

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, abrir `/contenido-extra`, elegir una lección y:
- Subir una imagen, escribir alt y comprobar que aparece en el editor y en la vista previa.
- Insertar un video de YouTube, comprobar miniatura y que se puede quitar.
- Guardar y reabrir la lección: ambos bloques siguen ahí y en orden.
Expected: sin errores en consola; `npx tsc --noEmit` limpio.

---

### Task 5: Vista previa de medios (CMS)

**Files:**
- Modify: `app/(panel)/cursos/[id]/lecciones/[lessonId]/preview.tsx`

**Interfaces:**
- Consumes: `ContentBlock` con `image` y `video`, `youtubeVideoId`, `youtubeThumbnail`, `mediaSrc`.

- [ ] **Step 1: Renderizar los bloques**

En `LessonReadingPreview`, añadir los casos antes del `return` de tabla:
- `image`: `<figure>` con `<img src={mediaSrc(block.mediaId)} alt={block.alt}>` y `figcaption` opcional.
- `video`: tarjeta con `<img src={youtubeThumbnail(id)}>` y enlace «Ver en YouTube» (`target="_blank"`, `rel="noreferrer"`); si el ID no se puede extraer, mostrar el título y la URL sin enlace.
- Añadir el aviso de conexión para video: «Requiere conexión».

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Run: `npm run dev` y comprobar la vista previa de los dos tipos.
Expected: imagen con caption y video con miniatura.

---

### Task 6: Modelo, parser y render multimedia en MLO

**Files:**
- Modify: `package.json` (`react-native-webview`)
- Modify: `src/shared/model/entities.ts`
- Modify: `src/shared/services/content/remote/validateLessonPayload.ts`
- Modify: `src/features/modules/view/RichContent.tsx`
- Create: `src/features/modules/view/VideoPlayer.tsx`
- Test: `src/features/modules/view/__tests__/RichContent.test.tsx`
- Test: `src/shared/services/content/__tests__/mediaBlocks.test.ts`

**Interfaces:**
- `ContentBlock` gana:
  - `{ type:'image'; src:string; localSrc?:string; mime:'image/jpeg'|'image/png'|'image/webp'; width:number; height:number; alt:string; caption?:string; mediaId?:string }`
  - `{ type:'video'; url:string; title:string }`
- `parseContentBlocks` valida ambos tipos.
- `VideoPlayer` props `{ videoId: string; title: string; visible: boolean; onClose(): void }`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npx expo install react-native-webview`
Expected: `package.json` y lock actualizados; no tocar otras dependencias.

- [ ] **Step 2: Escribir tests de parser y render**

Extender `validateLessonPayload` tests con un payload que incluya:

```ts
{ type: 'image', src: 'https://cms.test/api/media/x?sig=y', mime: 'image/webp', width: 10, height: 10, alt: 'Diagrama' }
{ type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Clase' }
```

`RichContent.test.tsx`:
- Mock `react-native-webview` con un `View` y `useTheme` como en `Bibliography.test.tsx`.
- Renderizar `RichContent` con una imagen y un video.
- `getByTestId('lesson-image')` y `getByTestId('lesson-video')` existen.
- `fireEvent.press(getByTestId('lesson-video'))` muestra `getByTestId('video-player')`.
- Simular `onError` de la imagen y esperar `getByText('Imagen no disponible sin conexión.')`.

- [ ] **Step 3: Implementar tipos, parser y render**

- `parseContentBlocks`: `image` requiere `src` string, `mime` permitido, `width`/`height` enteros > 0, `alt` no vacío; `localSrc` opcional. `video` requiere `url` y `title`.
- `RichContent`:
  - `ImageBlockView`: `Image` con `source={{ uri: block.localSrc ?? block.src }}`, `style={{ width:'100%', aspectRatio: width/height }}`, `resizeMode="contain"`, `testID="lesson-image"`; caption; en `onError` mostrar el texto de fallback.
  - `VideoBlockView`: miniatura `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, título, etiqueta «Requiere conexión», `Pressable` que abre `VideoPlayer`.
  - `VideoPlayer`: `Modal` con `WebView` a `https://www.youtube.com/embed/<id>?autoplay=1&playsinline=1&rel=0`, botón «Cerrar» y `testID="video-player"`; `onError` muestra un botón «Abrir en YouTube» con `Linking.openURL`.

- [ ] **Step 4: Correr tests**

Run: `npx jest src/shared/services/content/__tests__/mediaBlocks.test.ts src/features/modules/view/__tests__/RichContent.test.tsx --runInBand`
Expected: PASS.

---

### Task 7: Caché offline de imágenes en MLO

**Files:**
- Create: `src/shared/services/content/mediaCache.ts`
- Modify: `src/shared/services/db/schema.ts`
- Modify: `src/shared/services/content/remoteContent.ts`
- Modify: `src/shared/services/content/coursesV3.ts`
- Modify: `src/shared/services/content/classSync.ts`
- Test: `src/shared/services/content/__tests__/mediaCache.test.ts`

**Interfaces:**
- Produces:
  - `cacheMediaBlocks(db: SQLiteDatabase, blocks: ContentBlock[]): Promise<ContentBlock[]>`
  - `cacheMediaInManifest<T extends { lessons: unknown[] }>(db, manifest: T): Promise<T>`
  - `cacheMediaInGroupRelease(db, release: GroupManifest): Promise<GroupManifest>`
  - `cacheMediaInLessonPayload(db, payload: RemoteLessonPayload): Promise<RemoteLessonPayload>`

- [ ] **Step 1: Añadir la tabla y el test**

En `schema.ts` (`SCHEMA_DDL`):

```sql
CREATE TABLE IF NOT EXISTS media_cache (
  url TEXT PRIMARY KEY,
  local_uri TEXT NOT NULL,
  mime TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
```

Test con `jest.mock('expo-file-system')`:
- Primera llamada: descarga y devuelve el bloque con `localSrc`.
- Segunda llamada: no vuelve a descargar.
- Error de descarga: devuelve el bloque sin `localSrc`.
- `cacheMediaInGroupRelease` conserva `release.hash`.

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx jest src/shared/services/content/__tests__/mediaCache.test.ts --runInBand`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar la caché**

- `cacheMediaBlocks`: para cada `image`, si `localSrc` existe y el archivo existe, conservarlo; si no, descargar `src` a `Paths.document/media/<mediaId o hash>.<ext>` con `File.downloadFileAsync(url, file, { idempotent: true, signal })` y timeout de 10 s; guardar en `media_cache`; devolver copia con `localSrc`. Cualquier error se registra en `__DEV__` y devuelve el bloque intacto.
- `mimeToExtension`: `image/jpeg`→`jpg`, `image/png`→`png`, `image/webp`→`webp`.
- `cacheMediaInManifest`: mapea `lessons[].content` con `cacheMediaBlocks`.
- `cacheMediaInGroupRelease`: mapea `lessons[].content` y `additions[].blocks`; no toca `hash`.
- `cacheMediaInLessonPayload`: mapea `payload.lesson.content`.

- [ ] **Step 4: Conectar la sincronización**

- `refreshCatalog` (v2): antes de guardar el payload, `cacheMediaInLessonPayload`.
- `refreshCourseList`: antes de `JSON.stringify(manifest)`, `cacheMediaInManifest`.
- `stageClassRelease` y `refreshClassRelease`: antes de guardar `release_v3`, `cacheMediaInGroupRelease`.
- Si la descarga falla, la sincronización sigue igual.

- [ ] **Step 5: Correr tests**

Run: `npx jest src/shared/services/content/__tests__/mediaCache.test.ts src/shared/services/content/__tests__/remoteContent.test.ts src/shared/services/content/__tests__/classSync.test.ts --runInBand`
Expected: PASS.

---

### Task 8: Verificación integral

**Files:**
- Modify: `docs/superpowers/specs/2026-11-16-media-lessons-design.md` solo si cambió una decisión.

- [ ] **Step 1: Tests del CMS**

Run: `npm test`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: todo verde.

- [ ] **Step 2: Tests de MLO**

Run: `npx jest --runInBand`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: todo verde.

- [ ] **Step 3: E2E manual**

1. `npm run dev` en el CMS.
2. En `/contenido-extra`, crear una lección con una imagen (alt + caption) y un video de YouTube.
3. Publicar el grupo.
4. En MLO, sincronizar el grupo.
5. Activar modo avión: la imagen se ve; el video muestra el aviso de conexión.
6. Con red: tocar el video y comprobar que se reproduce dentro de MLO en el modal.
7. Repetir con una imagen de más de 3 MB y con un SVG: la subida debe rechazarse.

Expected: los siete pasos se cumplen sin errores de consola.
