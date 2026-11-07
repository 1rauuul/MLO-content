# Plan — Constructor de cursos completo y vista previa MLO

## Objetivo

Convertir el panel de maestros en un constructor de cursos autónomos. Un curso no
dependerá del catálogo `base`: el autor podrá crear su estructura y contenido
completos, publicarlos como una versión inmutable y asignar cada clase a un curso.
MLO descargará ese curso y lo mostrará localmente, aplicando el mismo diseño y los
tipos de actividades que ya admite.

## Decisiones de producto

- El curso base actual se conserva como un curso legado, pero deja de ser una
  dependencia implícita de los cursos nuevos.
- Toda clase pertenece exactamente a un curso. No habrá clases sin curso.
- La estructura editorial será:

  ```text
  Curso → Unidades → Subtemas → Lecciones
                              ↘ ejemplos y ejercicios de práctica
                              ↘ evaluaciones → preguntas y ejercicios
  ```

- Las lecciones contienen bloques de lectura; ejemplos y ejercicios pueden
  referenciar una lección concreta o vivir al nivel del subtema cuando aplique.
- Las evaluaciones pertenecen a un subtema y pueden incluir preguntas y ejercicios.
  Esto elimina la restricción actual de una sola evaluación por lección.
- Los tipos permitidos se mantienen inicialmente: `mcq`, `order`, `fill`, `match`
  y `crossword`; no se agrega multimedia en esta fase.
- Un release de curso contiene todo el curso publicado. Un release de clase contiene
  solamente sus extras y declara explícitamente el `catalogId` del curso asociado.

## Impacto en MLO

Sí es necesario modificar MLO. Hoy el cliente solo sincroniza `base`
(`catalogsInUse()` devuelve `['base']`) y una clase no guarda el curso al que
pertenece. Sin esos cambios, MLO no puede descubrir, descargar ni navegar un curso
creado en el CMS.

## Propuesta visual previa — sin implementar MLO

Antes de modificar la app se presentará y aprobará una propuesta visual. No se
crearán pantallas, rutas ni cambios de lógica en el repositorio de MLO durante esta
etapa. El artefacto de revisión es
[`docs/prototypes/mlo-cursos-propuestal.html`](docs/prototypes/mlo-cursos-propuestal.html),
un prototipo local navegable basado en los tokens, componentes y jerarquía visual
actuales de MLO.

La propuesta se complementa con
[`docs/prototypes/cms-propuestal.html`](docs/prototypes/cms-propuestal.html),
un prototipo interactivo del constructor dentro del CMS. Permite recorrer el árbol
curso → unidad → subtema → actividades, cambiar el tipo de editor y actualizar en
vivo una pantalla simulada de MLO. Ambos archivos son artefactos de presentación,
sin conexión a base de datos ni cambios en las aplicaciones reales.

Para presentar el recorrido completo desde un estado vacío está disponible
[`docs/prototypes/cms-curso.html`](docs/prototypes/cms-curso.html).
El prototipo permite crear, en ese orden, un curso, una clase, una unidad, un
subtema, una lección, un ejemplo, un ejercicio y una evaluación. El árbol y la
pantalla de MLO reaccionan a cada paso; tampoco guarda datos ni implementa cambios
de producto.

La copia ampliada
[`docs/prototypes/cms-curso-interactivo.html`](docs/prototypes/cms-curso-interactivo.html)
permite añadir exactamente un elemento de cada tipo y lo representa de forma
acumulativa en la pantalla simulada de MLO. También permite escoger entre crear
un curso vacío, crear un curso cargando el contenido núcleo, o abrir un curso ya
existente de demostración y añadirle el nuevo contenido.

La propuesta incluye cinco estados:

1. **Mis cursos**, pantalla de entrada previa al curso: reúne los cursos disponibles
   para el alumno, incluso si no existe ni se descargó el curso `base`.
2. **Unirme a una clase**, como entrada por código que confirma el curso asociado
   antes de iniciar la sincronización.
3. **Detalle de curso**, con progreso y unidades de un curso autónomo.
4. **Hub de subtema**, que reúne lecciones, ejemplos, práctica y evaluación.
5. **Lección**, con la presentación de lectura que ya caracteriza a MLO.

La decisión de navegación y la apariencia se revisarán contra este prototipo. Solo
tras el visto bueno se iniciará la Fase 5; el prototipo no es código de producción
ni forma parte del APK.

## Fase 0 — Contrato y modelo compartido

1. Definir el contrato **v3** con ejemplos JSON y versionado explícito.
2. Extraer tipos, serializador y validadores puros a un paquete compartido
   `mlo-content-contract`; será consumido por CMS y MLO.
3. Mantener el lector v2 en MLO durante una ventana de migración; los cursos nuevos
   se publican en v3 y el curso base puede migrarse después.
4. Incluir en el manifest: `catalogId`, versión, hash, unidades, subtemas y hashes
   de los documentos descargables. El payload publicado debe incluir la jerarquía y
   los IDs globalmente únicos del catálogo.
5. Añadir `catalogId` al preview, join y release de una clase.

**Criterio de aceptación:** un fixture v3 se valida igual en Node (CMS) y React
Native (MLO); un payload inválido no llega a persistirse en ninguno de los dos lados.

## Fase 1 — Base de datos del CMS

1. Crear `topics` con `unit_id`, `content_id`, título, descripción y posición.
2. Migrar `lessons` para relacionarlas con `topic_id`; mantener temporalmente
   `unit_id` para compatibilidad y rellenarlo desde el subtema padre.
3. Reemplazar la relación única de evaluación por lección por una relación
   `evaluations.topic_id` y crear la tabla puente `evaluation_exercises` para los
   ejercicios de evaluación.
4. Distinguir el contexto del ejercicio (`practice` o `evaluation`) y conservar los
   ejercicios de práctica vinculados a lección.
5. Permitir ejemplos por lección y por subtema, con posición estable.
6. Añadir `classes.course_id NOT NULL`; migrar las clases existentes al curso `base`.
7. Añadir `catalog_id` a `class_releases` y guardarlo dentro del snapshot.
8. Eliminar de publicación la composición automática `base + curso del maestro`.
   Cada curso publica exclusivamente sus propias unidades, subtemas y contenido.
9. Preparar una migración de datos idempotente para el core actual:
   crear un subtema por unidad, mover las lecciones existentes y asociar sus
   evaluaciones.

**Criterio de aceptación:** las restricciones de base impiden contenido huérfano,
posiciones duplicadas y una clase sin curso; el release del core existente sigue
siendo legible durante la transición.

## Fase 2 — Constructor editorial del CMS

1. Reemplazar el flujo actual de “curso propio sobre core” por un asistente:
   crear curso → unidades → subtemas → lecciones y actividades.
2. Añadir vistas de árbol con reordenamiento y contadores de completitud.
3. Crear formularios para:
   - lecciones y bloques de lectura;
   - ejemplos independientes;
   - ejercicios de práctica;
   - evaluaciones del subtema;
   - preguntas y ejercicios dentro de una evaluación.
4. Reutilizar los validadores actuales de `order`, `fill`, `match` y `crossword`,
   validando al guardar y nuevamente antes de publicar.
5. Cambiar `/contenido-extra` para que el autor elija curso → unidad → subtema →
   lección, y solo pueda asignar contenido a clases del mismo curso.
6. Cambiar `/clases` para exigir la selección de un curso en el alta y mostrar la
   versión publicada de ese curso junto con la versión del release de clase.
7. Conservar permisos: maestro administra sus cursos y clases; administrador ve y
   administra todos.

**Criterio de aceptación:** un maestro puede crear desde cero un curso con la
jerarquía completa y publicar un release sin consultar ni incluir el core.

## Fase 3 — Publicación y API del CMS

1. Implementar composición v3 desde un curso autónomo, ordenando por unidad,
   subtema y posición.
2. Calcular hash por documento y hash de release con JSON canónico.
3. Exponer manifest y recursos v3 bajo rutas versionadas, sin cambiar las v2 hasta
   completar la migración.
4. Modificar las rutas de clase para incluir el catálogo de su clase y bloquear la
   descarga de extras que no correspondan a dicho catálogo.
5. Mantener releases inmutables, transacciones y bloqueo pesimista de versión.
6. Añadir controles de rate limit al `join` y definir CORS de producción por origen,
   en lugar de permitir cualquier origen.

**Criterio de aceptación:** un release v3 de prueba pasa validación de contrato,
sus hashes son estables y el endpoint nunca devuelve borradores.

## Fase 4 — Vista previa fiel a MLO dentro del CMS

1. Construir `MloPreviewShell`: un marco de teléfono responsivo con la jerarquía,
   cabecera, espaciados, tipografía, colores y navegación visual de MLO.
2. Usar tokens de diseño y un adaptador de contenido compartidos; no copiar a mano
   reglas de presentación desde React Native.
3. Ofrecer modos de preview equivalentes a la app: lectura, ejemplo, práctica y
   evaluación. Incluir estados interactivos de cada tipo de ejercicio sin guardar
   intentos ni progreso.
4. Conectar el preview al borrador del formulario con actualización inmediata y
   mostrar errores de contrato en el elemento que los produce.
5. Mostrar el preview tanto en el editor de lección como en el alta de ejemplo,
   ejercicio, evaluación y contenido extra de clase.
6. Añadir pruebas visuales/snapshots para tamaños móvil y escritorio y pruebas de
   equivalencia del modelo de renderizado contra fixtures de MLO.

**Criterio de aceptación:** un autor puede revisar, antes de guardar, la pantalla que
verá un alumno y el resultado usa los mismos tipos y reglas del contrato de MLO.

## Fase 5 — Cambios requeridos en MLO

1. Subir la versión de SQLite y añadir `catalog_id` a la caché de clases, membresías
   y extras; migrar datos existentes hacia `base`.
2. Sustituir `catalogsInUse(): ['base']` por catálogos obtenidos de las clases y de
   los cursos locales inscritos/seleccionados.
3. Al unirse a una clase, guardar el `catalogId` que devuelve el CMS y sincronizar
   ese catálogo antes de aplicar los extras de la clase.
4. Adaptar la navegación para mostrar cursos disponibles y sus unidades/subtemas;
   la UI conserva sus componentes y tokens actuales, pero deja de asumir que solo
   existe `base`.
5. Implementar el lector, staging, validación y aplicación atómica del contrato v3.
6. Mantener el contenido y la caché anterior si falla una descarga, una validación o
   una migración local.
7. Adaptar práctica, ejemplos y evaluación para consumir el orden y la pertenencia
   por subtema definidos en v3.

**Criterio de aceptación:** un APK `hybrid` puede unirse a una clase asociada a un
curso creado desde cero, descargar el curso y usarlo sin conexión tras cerrar la app.

## Fase 6 — Migración, verificación y despliegue

1. Importar el core actual como curso v3 de referencia y comparar su render contra
   la versión v2.
2. Ejecutar pruebas unitarias de validación, composición, hashes, permisos y
   migraciones en CMS y MLO.
3. Añadir pruebas HTTP con releases reales y pruebas E2E: crear curso → crear clase
   → unirse desde MLO → sincronizar → abrir contenido sin conexión.
4. Probar restauración de respaldo para confirmar que identidad, clases, catálogos y
   progreso no se duplican.
5. Desplegar primero CMS compatible con v2/v3; después un APK `hybrid` con v3;
   retirar v2 solamente cuando no haya clientes activos que lo necesiten.

## Entregables por hito

| Hito | Entregable |
|---|---|
| H0 | Contrato v3, fixtures y paquete de validación compartido |
| H1 | Migraciones CMS y datos heredados compatibles |
| H2 | Constructor de curso, unidades, subtemas y actividades |
| H3 | Publicación/API v3 y clases asociadas a curso |
| H4 | Preview MLO fiel e interactivo en el CMS |
| H5 | MLO multicatálogo, sincronización y navegación |
| H6 | E2E en dispositivo, despliegue y retirada controlada de v2 |

## No hacer en esta iniciativa

- No introducir nuevos tipos de ejercicio ni multimedia antes de estabilizar v3.
- No permitir que una clase mezcle contenido de dos cursos.
- No publicar cambios de borrador automáticamente.
- No sustituir el comportamiento offline por renderizado remoto.
