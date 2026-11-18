# Historial de evolución — MLO

Registro legible de los cambios de producto. El estado detallado del panel vive en
`PLAN.md`; los contratos, en `docs/contracts/`; y la cronología de la app en
`MLO-Ingenieria-software/docs/estado/linea-de-tiempo.md`.

## 2026-11-18 · Editor de contenido del grupo y seguimiento de cambios

### Panel (`mlo-teachers`)

- **Editar contenido del grupo.** Nueva pantalla `/grupos/[id]/contenido` con todas las
  lecciones, ejemplos, ejercicios y evaluaciones del grupo, numerados por unidad y subtema.
- **Editores propios del grupo.** Ejemplos y ejercicios se editan en
  `/grupos/[id]/contenido/{ejemplos|ejercicios}/[id]`, con la misma vista previa interactiva de
  la lección.
- **Vista previa interactiva en Contenido adicional.** El editor muestra la actividad
  (ordenar, completar, relacionar, crucigrama) funcionando antes de guardar.
- **Cambios pendientes.** La tabla `class_content_changes` (con triggers sobre lecciones,
  ejemplos, ejercicios, evaluaciones, unidades y subtemas) registra qué subtemas cambiaron desde
  la última publicación. La tarjeta **Versión del grupo** muestra el último cambio y los
  subtemas pendientes.
- **Editar estructura desde el grupo.** Unidades y subtemas se editan con `unit-edit-form` y el
  modo `?vista=estructura&volver=…`; los enlaces conservan la ruta de vuelta con `backTo`.
- **Confirmaciones centradas.** Los pop ups de **Guardar curso** y **Publicar grupo** centran el
  mensaje y simplifican el texto.
- **Invitaciones.** Página HTTPS `/join` para abrir la invitación y enlace para abrir MLO local
  desde el correo. Corregido el color del selector de curso.
- **Pruebas.** 145/145, `lint`, `tsc` y `build` en verde; migraciones de cambios de contenido
  aplicadas en la base.

### App (`MLO-Ingenieria-software`)

- **Portada.** Slides de bienvenida con los logos de CINVESTAV (`SplashSlides`), splash nativo
  retirado y `versionCode` 6.
- **Perfil.** Ajuste **Mostrar curso base** persistente; la lista de clases y la unión a clase
  pasaron a la pantalla del curso.
- **Curso.** Botón **Salir del curso** con confirmación y limpieza de la clase activa.
- **Lección.** Se eliminó el paginado Concepto/Síntesis: todo el contenido se lee en una sola
  pantalla, con el contenido extra de las clases debajo.
- **Medios.** Las imágenes se muestran con marco y fondo suave; el campo para unirse a una clase
  acepta el código en mayúsculas y lo centra.
- **Contenido de grupos.** Una unidad del curso padre vuelve a mostrarse si un grupo agrega una
  lección bajo ella (`applyV3Content`).
- **Pruebas.** 581/581 y TypeScript limpio.

| Verificación | Resultado |
|---|---|
| `npm test` (panel) | 145/145 |
| `npm run lint` + `tsc` + `build` (panel) | Sin errores |
| `npx jest` (app) | 581/581 |
| `tsc` (app) | Sin errores |

## 2026-11-17 · Medios en lecciones, invitaciones y editor de actividades

### Panel (`mlo-teachers`)

- **Imágenes y video en lecciones.** Bloques `image` y `video` en el contenido editable, en el
  orden que elige el maestro. El contrato v3 pasa de 5 a 7 tipos de bloque. El curso base no
  muestra los controles multimedia para no alterar el payload v2 que consume la app antigua.
- **Imágenes.** Subida desde el navegador (máx. 1600 px, JPEG/PNG/WebP, 3 MB), tabla `media`
  con una sola copia por hash, endpoint `GET /api/media/[id]` con ETag y URLs firmadas con
  `MEDIA_SECRET`. Al publicar, `src` se convierte en una URL absoluta firmada (`APP_BASE_URL`).
- **Video.** Solo YouTube (`watch`, `youtu.be`, `shorts`, `embed`); la app muestra miniatura y
  reproduce en un modal. El video requiere conexión.
- **Invitaciones por correo.** El mensaje incluye un código de respaldo; se guarda el historial
  de entrega (`sent_at`, `delivery_error`) y hay un límite de 60 altas por hora y docente.
- **Evaluaciones.** Se aplicó la migración que permite actividades directas al subtema; crear
  evaluación y guardar preguntas ahora devuelve el error al formulario y la publicación rechaza
  una evaluación sin preguntas.
- **Editor de actividades.** Botón **Ver muestra** en los formularios de ejercicio y ejemplo:
  muestra completa por tipo (ordenar, completar, relacionar, crucigrama), chips ligados a los
  campos y **Usar esta muestra** para copiarla. Las muestras se validan con las reglas estrictas
  de publicación. La vista previa del crucigrama muestra las pistas con `H1`/`V1` y el número de
  letras.

### App (`MLO-Ingenieria-software`)

- **Render de medios.** `ContentBlock` suma `image` y `video`; `RichContent` muestra imágenes
  (`localSrc` primero) y video con miniatura; `VideoPlayer` usa `react-native-webview`.
- **Offline.** Tabla `media_cache` y descarga de imágenes al sincronizar; si falla una descarga,
  la sincronización continúa y se usa la URL remota. `mediaPath.ts` centraliza la ruta local.
- **Contenido de grupos.** El release de curso ya no archiva ni borra el contenido propio de los
  grupos (`group_id IS NULL`); así no desaparece lo que el alumno ve en su clase.
- **Unión a grupo.** La unión y el release distinguen una clase sin publicar (`409 unpublished`)
  de una inexistente, con mensaje propio en la pantalla de unirse.
- **Pruebas.** 573/573 en verde; TypeScript limpio. La suite `updateNotice` tuvo un timeout
  aislado que no se reprodujo al repetirla.

### Verificación de esta entrega

| Comando | Resultado |
|---|---|
| `npm test` (panel) | 143/143 |
| `npm run lint` (panel) | Sin errores |
| `npx tsc --noEmit` (panel) | Sin errores |
| `npm run build` (panel) | Compila |
| `npx tsc --noEmit` (app) | Sin errores |
| `npx jest` (app) | 573/573 |
| Migraciones | `media`, RLS de medios e historial de invitaciones aplicadas en la base |

Recorrido manual en navegador de la referencia visual: los cuatro tipos, el modal de ejemplo y
**Usar esta muestra**. No se guardaron datos de prueba.

### Despliegue

Configurar en el CMS `APP_BASE_URL` y `MEDIA_SECRET`. Sin esos valores, las URLs de las imágenes
publicadas no se pueden firmar. Las migraciones de medios e invitaciones ya están aplicadas en la
base compartida.

## 2026-11-13 · Flujo del panel docente

- **Guardar** publica el curso y confirma en un pop up; se eliminó la pantalla intermedia
  `/cursos/[id]/publicar`.
- **Publicar grupo** confirma en un pop up e indica el código para unirse.
- Cards de grupos más compactas (3 columnas) y ordenadas por más nuevos.
- Numeración `unidad.subtema` en el grupo, la cabecera del subtema y Contenido adicional.
- Unirse a un grupo y crear invitaciones exigen una publicación previa (`409 unpublished`).

## 2026-10-27 · Base del CMS y contrato v3

- Panel Next.js 16 con auth propia, cursos, unidades, subtemas, lecciones, ejercicios, ejemplos
  y evaluaciones.
- Core compartido importado una sola vez; el maestro solo agrega contenido propio.
- Publicación por snapshot inmutable con hashes; API `/api/mlo/v2` y `/api/mlo/v3`.
- Clases con código fijo, alumnos por UUID estable, contenido extra y publicación por grupo.
- App MLO adaptada al contrato v3, identidad del alumno, caché de clases y respaldo de progreso.
