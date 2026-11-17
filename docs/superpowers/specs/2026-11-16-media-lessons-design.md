# Imágenes y video en lecciones — Diseño

**Fecha:** 2026-11-16
**Repos:** `mlo-teachers` (CMS) y `MLO-Ingenieria-software` (app)

## Intención

Que un maestro pueda agregar imágenes y videos a una lección desde
`/contenido-extra`, y que el alumno los vea en MLO. Las imágenes deben quedar
disponibles sin conexión; los videos se reproducen dentro de la app y requieren
conexión.

## Decisiones

- **Almacenamiento de imágenes:** tabla `media` en Postgres (bytea), una sola
  copia por hash. Los releases llevan solo la URL.
- **Entrega:** endpoint `GET /api/media/[id]` con ETag y caché inmutable. Las
  URLs de los releases van firmadas con HMAC (`MEDIA_SECRET`); la sesión del
  maestro puede previsualizar sin firma.
- **Offline:** MLO descarga las imágenes al sincronizar y guarda una copia local.
  Si falla una descarga, la sincronización continúa y se usa la URL remota.
- **Video:** solo YouTube. Miniatura automática y reproducción dentro de MLO con
  `react-native-webview` en un modal. No se descarga video.
- **Editor:** bloques `image` y `video` dentro del contenido editable, en el
  orden elegido por el maestro.
- **Compatibilidad:** el curso base no muestra los controles multimedia, para no
  introducir bloques nuevos en el payload v2 que consume MLO antiguo. Los
  releases v3 son aditivos: un cliente viejo ignora los bloques nuevos.

## Bloques

```ts
type ImageBlock = {
  type: "image";
  mediaId: string;
  src: string; // relativa en el CMS; absoluta y firmada al publicar
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  alt: string;
  caption?: string;
};

type VideoBlock = {
  type: "video";
  url: string; // URL canónica de YouTube
  title: string;
};
```

## Flujo

1. El navegador comprime la imagen (máx. 1600 px, WebP/JPEG) y la sube a
   `POST /api/media`.
2. El CMS guarda `media` y el bloque referencia `mediaId`.
3. Al publicar, `src` se reemplaza por una URL absoluta firmada.
4. MLO recibe el release, descarga cada imagen firmada a
   `document/media/<mediaId>.<ext>` y guarda `localSrc` en la caché.
5. `RichContent` prefiere `localSrc`; si no existe, usa `src`.
6. El video muestra miniatura de YouTube y abre un modal con el embed.

## Límites

- Imágenes: 3 MB, formatos JPEG/PNG/WebP, sin SVG.
- Video: solo YouTube (`watch`, `youtu.be`, `shorts`, `embed`).
- Variables nuevas: `APP_BASE_URL` y `MEDIA_SECRET`.
- Sin limpieza de medios huérfanos en esta versión (`shortcut`).

## No objetivos

- Subida múltiple, biblioteca de medios reutilizable o edición de imágenes.
- Vimeo, MP4 directo, HLS o descarga de video para offline.
- Limpieza automática de archivos huérfanos.
