# Especificación de navegación — MLO Maestros

Este documento registra las decisiones de producto tomadas durante el recorrido de la aplicación. Se actualizará conforme se revisen más pantallas.

## Crear curso

### Eliminar la acción duplicada

La pantalla **Crea un curso desde cero** muestra actualmente dos acciones para enviar el formulario: una dentro del formulario y otra fija en la esquina inferior derecha.

**Decisión:** eliminar por completo el botón fijo de la esquina inferior derecha en todos los tamaños de pantalla y estados de la interfaz.

**Se conserva:** el botón **Crear curso** dentro del formulario, después de la opción **Cargar contenido base**. Este será el único punto de creación del curso.

**Motivo:** al recorrer el formulario, la persona llegará de forma natural a su acción final. Mantener una segunda acción fija resulta redundante.

**Criterio de aceptación:** en la pantalla de creación hay un único botón **Crear curso**, ubicado al final del formulario; no hay barra ni botón de creación fijo en la parte inferior.

## Crear grupo

### Seleccionar explícitamente el curso del grupo

Al crear un grupo, el sistema no debe asignar un curso de forma automática ni inferir uno por defecto.

**Decisión:** el formulario de creación del grupo debe mostrar con claridad el curso al que se asociará el grupo y permitir que la persona lo seleccione antes de crear el grupo.

**Se conserva:** en el detalle del grupo se debe seguir mostrando el curso asociado como referencia visible.

**Motivo:** quien crea el grupo debe saber y controlar qué curso recibirá ese grupo antes de confirmarlo.

**Criterio de aceptación:** no se puede crear un grupo sin una selección de curso explícita; antes de confirmar, la interfaz muestra el nombre del curso seleccionado y, después de crear el grupo, el detalle refleja esa misma asociación.

## Edición de curso

### Simplificar la cabecera del curso

La cabecera muestra, junto al título, cuatro indicadores: la clave del catálogo, el nivel, el estado de publicación y la etiqueta de contenido base.

**Decisión:** eliminar de la cabecera los indicadores de clave del catálogo, nivel, **Borrador** y **Con contenido base**.

**Alcance:** esta decisión aplica a esos indicadores de la cabecera del curso; no elimina los datos de nivel ni de contenido base que se muestran dentro de las unidades o subtemas cuando sean pertinentes.

**Criterio de aceptación:** junto al título del curso no aparecen la clave, el nivel, el estado de borrador ni la etiqueta de contenido base. Se conservan el título, la descripción y las acciones de la cabecera.

### Contraer el formulario para agregar una unidad

Actualmente, al final del contenido del curso se muestra de forma permanente el formulario completo para crear una unidad: título, descripción, nivel, color y acción de confirmación.

**Decisión:** reemplazar ese formulario visible por un botón **Agregar unidad** ubicado en la cabecera del curso, antes de la lista de unidades y subtemas. Debe ser visible al abrir la pantalla, sin requerir recorrer el contenido. Al activarlo, el botón despliega el formulario completo de creación de unidad en esa misma zona; antes de activarlo, el formulario permanece oculto.

**Motivo:** reduce el ruido visual al recorrer las unidades y subtemas existentes, sin perder la posibilidad de agregar una nueva unidad cuando se necesite.

**Criterio de aceptación:** al cargar la pantalla, el botón **Agregar unidad** es visible en la cabecera del curso y solo él representa la acción de añadir una unidad. Al seleccionarlo se despliegan todos los campos necesarios y la acción para confirmar la creación; los campos dejan de mostrarse nuevamente cuando el formulario se cierre o se complete la acción.

### Eliminar la sección de acceso del curso

La sección **Acceso**, incluidos su texto explicativo, listado de alumnos y formulario para conceder acceso, debe eliminarse por completo de la pantalla de edición del curso.

**Criterio de aceptación:** después de la zona para agregar unidades no se muestra ninguna sección ni control relacionado con el acceso de alumnos al curso.

### Numerar los subtemas por unidad en la aplicación de React

Cada unidad está formada por una lista ordenada de subtemas. En la aplicación de React, los subtemas deben mostrar una numeración jerárquica que permita identificar a qué unidad pertenecen.

**Decisión:** anteponer a cada subtema su número de unidad y su posición dentro de esa unidad, con el formato `unidad.subtema`.

**Ejemplo:** los primeros cinco subtemas de la unidad 1 se muestran como `1.1`, `1.2`, `1.3`, `1.4` y `1.5`; los de la unidad 2 comienzan con `2.1`.

**Criterio de aceptación:** la numeración se calcula a partir del orden actual de unidades y subtemas y se muestra antes del nombre de cada subtema en la aplicación de React. El primer subtema de toda unidad comienza en `.1`.

### Simplificar las filas de subtemas

En la lista de subtemas de cada unidad se muestran actualmente metadatos como el número de lecciones y la etiqueta **Contenido base**.

**Decisión:** ocultar el contador de lecciones (por ejemplo, **1 lecciones**) y la etiqueta **Contenido base** de todas las filas de subtemas.

**Criterio de aceptación:** cada fila de subtema muestra su numeración, nombre y los datos necesarios para navegar o editarlo, pero no muestra el conteo de lecciones ni la procedencia de contenido base.

### Dar mayor énfasis a las acciones de creación

Los botones que confirman una creación deben distinguirse claramente de los campos y elementos informativos cercanos.

**Decisión:** aplicar un tratamiento visual de acción principal a los botones de creación. En particular, **Crear subtema** debe resaltarse dentro de cada unidad mediante un fondo sólido de acción, contraste suficiente, jerarquía tipográfica y separación visual respecto de los campos que completa.

**Criterio de aceptación:** al recorrer una unidad, la acción **Crear subtema** se identifica de inmediato como el siguiente paso para guardar el nuevo subtema. El mismo criterio de énfasis se reutiliza para las demás acciones principales de creación de la pantalla.

### Eliminar enlaces sin destino de los subtemas

Los nombres de los subtemas se presentan como hipervínculos, pero su destino no ofrece una pantalla funcional.

**Decisión:** eliminar el comportamiento y la apariencia de hipervínculo de los nombres de subtema en la lista de unidades. Deben mostrarse como texto informativo, no como acciones navegables.

**Criterio de aceptación:** seleccionar el nombre de un subtema no abre una ruta ni muestra una pantalla inexistente. La lista no da a entender que esos nombres son enlaces.

### Mostrar los grupos asociados al curso

La pantalla de edición del curso debe hacer visible qué grupos dependen de ese curso.

**Decisión:** incluir una sección **Grupos asignados** en la parte superior de la pantalla del curso, antes de la lista de unidades. Debe mostrar por nombre todos los grupos que tienen asociado el curso actual.

**Estado vacío:** cuando ningún grupo esté asociado, la sección debe comunicarlo de forma clara.

**Criterio de aceptación:** al abrir un curso, se puede identificar sin salir de la pantalla los grupos asociados a él. Al crear o reasignar un grupo a ese curso, la lista refleja la asociación vigente.

## Contenido adicional

### Agregar contenido desde cada subtema

Cada subtema debe ofrecer una acción visible **Agregar contenido**. Esta acción abre la pantalla de creación de contenido adicional desde el contexto del subtema elegido.

**Decisión:** al entrar por esta acción, la pantalla de contenido adicional debe recibir automáticamente el grupo seleccionado previamente y el subtema de origen. Ambos valores se muestran como contexto ya definido, sin pedir que la persona los seleccione de nuevo.

**Flujo:** la persona selecciona **Agregar contenido** en un subtema; llega directamente a la creación de contenido adicional con el grupo y el subtema completados; después, solo elige el tipo de contenido que desea añadir y completa sus datos.

**Criterio de aceptación:** la creación iniciada desde un subtema no requiere volver a elegir Grupo ni Subtema. La pantalla indica claramente dónde se publicará el contenido y conserva disponibles las opciones para crear lección, ejemplo, ejercicio o evaluación.

### Simplificar la vista previa al crear contenido

Después de elegir un tipo de contenido, la vista previa muestra un resumen superior del subtema completo: unidad, nombre del subtema, estado y tarjetas con conteos de lecciones, ejemplos, ejercicios y evaluaciones.

**Decisión:** eliminar ese resumen superior de la vista previa. Se conserva solamente la previsualización específica del componente que se está creando, a partir del bloque que muestra cómo se verá la lección, ejemplo, ejercicio o evaluación en MLO.

**Criterio de aceptación:** al crear un tipo de contenido, la vista previa no muestra cabecera de unidad/subtema, estado ni tarjetas de conteo. Muestra directamente el resultado visual del tipo de contenido seleccionado y se actualiza conforme se completa su formulario.

### Asociar el contenido directamente al subtema

Una vez definido el subtema de destino, el selector **Lección de contexto** no debe mostrarse ni ser necesario para continuar.

**Decisión:** las lecciones, ejemplos, ejercicios y evaluaciones creados desde este flujo se asocian directamente al subtema seleccionado. La interfaz conserva visible el contexto ya definido —grupo y subtema—, pero no pide elegir una lección ni obliga a crear una antes.

**Criterio de aceptación:** al elegir un tipo de contenido, no aparece el selector **Lección de contexto** ni un mensaje que bloquee la creación por falta de lecciones. El contenido creado queda disponible en el subtema de origen.

### Formularios guiados según el contenido que verá el alumno

Los formularios deben reflejar la forma en que cada componente se renderiza en MLO. Deben ser agradables de recorrer, visualmente claros y mostrar solo los campos que corresponden al tipo de contenido seleccionado.

**Principios compartidos:**

- Mantener visibles el tipo elegido y el contexto de publicación.
- Organizar cada formulario en secciones cortas con títulos descriptivos, ayuda breve y una acción principal clara.
- Usar controles visuales para listas, pares, pasos y opciones; no exponer configuraciones técnicas ni datos estructurados en bruto.
- Actualizar en vivo la previsualización específica del componente.
- Usar iconos, color y espaciado consistente para que la creación sea fácil de escanear y agradable de usar.

**Lección:** solicitar código y título, seguido de un editor visual de bloques de lectura. El editor debe permitir agregar y ordenar párrafos, subtítulos, viñetas, listas numeradas y tablas, tal como se muestran al alumno.

**Relación entre ejemplo y ejercicio:** un ejemplo es un ejercicio con una explicación guiada. No debe tener un constructor distinto ni un conjunto reducido de tipos.

**Ejercicio:** permitir elegir entre ordenar, completar, relacionar o crucigrama. Mostrar, según el tipo, una secuencia reordenable, oraciones con espacios, pares o un constructor de crucigrama. Incluir los campos comunes de enunciado e instrucciones.

Al crear un ejercicio, debe ofrecerse la opción **Agregar también como ejemplo**. Esta opción comienza contraída para no recargar el formulario; al activarla, despliega el menú de explicación del ejemplo con solución paso a paso y pistas. Si no se activa, se crea únicamente el ejercicio.

**Ejemplo:** reutilizar el mismo constructor y los mismos cuatro tipos de un ejercicio. Además de su solución, debe pedir una explicación clara y guiada de cómo resolverlo, con pasos y pistas cuando correspondan. Esta explicación es lo que distingue al ejemplo del ejercicio.

#### Diseño del formulario de ejemplo

La opción **Ejemplo** se mantiene como una sección independiente dentro de los tipos de contenido. Al elegirla, el formulario debe presentar el siguiente recorrido:

1. **Elige el tipo de actividad:** tarjetas visuales para Ordenar, Completar, Relacionar y Crucigrama.
2. **Construye el ejercicio:** el mismo editor específico del tipo elegido que usa un ejercicio: secuencia, oraciones y espacios, pares o palabras y pistas del crucigrama.
3. **Explica la solución:** una sección destacada para describir la resolución paso a paso. Los pasos deben admitir qué se hace y por qué; las pistas complementarias son opcionales.
4. **Comprueba el resultado:** una previsualización en vivo muestra el ejercicio y, después, la explicación que verá el alumno.
5. **Elige cómo publicarlo:** antes de guardar, se presentan dos opciones claras: **Solo como ejemplo** o **Como ejemplo y ejercicio**.
6. **Crea el contenido:** una acción principal visible y diferenciada confirma la opción elegida.

**Opciones de publicación:**

- **Solo como ejemplo:** publica únicamente la actividad explicada.
- **Como ejemplo y ejercicio:** reutiliza la misma actividad para publicar también su versión interactiva de ejercicio; el ejemplo conserva la solución explicada.

**Criterio de aceptación:** la persona reconoce que está creando un ejemplo, puede usar cualquiera de los cuatro tipos de ejercicio sin cambiar de flujo y entiende que debe aportar una solución explicada antes de publicarlo. Antes de confirmar, debe poder decidir explícitamente si la actividad aparece solo como ejemplo o también como ejercicio.

Al crear un ejercicio, la opción **Agregar también como ejemplo** permite publicar ambas versiones desde el mismo formulario y revela los campos de explicación solo cuando son necesarios.

**Evaluación:** comenzar con título y descripción. Después de crearla, ofrecer un flujo claro para agregar preguntas de opción múltiple, ordenar, completar, relacionar o crucigrama, y para incorporar ejercicios ya disponibles en el mismo subtema. Cada pregunta usa un formulario visual específico para su tipo.

#### Refactor del constructor de evaluaciones

El constructor de evaluaciones debe organizarse como una experiencia de composición, no como un formulario técnico con configuraciones manuales.

**Estructura propuesta:**

1. **Datos de la evaluación:** título y descripción breve, con el grupo y subtema de destino visibles como contexto fijo.
2. **Contenido de la evaluación:** lista ordenable de elementos que permite agregar una pregunta nueva o incorporar un ejercicio disponible del mismo subtema.
3. **Crear una pregunta:** tarjetas para elegir Opción múltiple, Ordenar, Completar, Relacionar o Crucigrama. Al seleccionar un tipo, aparece solamente su constructor visual correspondiente.
4. **Revisar y publicar:** resumen de preguntas y ejercicios incluidos, con opción de editar, quitar o reordenar cada elemento y una vista previa de la evaluación tal como la verá el alumno.

**Reglas de diseño:**

- No mostrar JSON, índices técnicos ni campos de configuración en bruto.
- Cada pregunta debe solicitar únicamente sus datos necesarios: enunciado, opciones o respuestas, solución y explicación cuando aplique.
- La selección de respuesta correcta debe hacerse con un control visual, no escribiendo un número de índice.
- Los ejercicios disponibles se muestran como tarjetas seleccionables con su tipo y título.
- La acción de crear o guardar la evaluación debe mantenerse visible y tener el mismo énfasis que las demás acciones principales.

**Criterio de aceptación:** una persona puede crear una evaluación completa, añadir preguntas de distintos tipos y seleccionar ejercicios del subtema sin conocer estructuras internas ni abandonar el flujo. La previsualización y el orden final coinciden con la experiencia del alumno.

**Criterio de aceptación:** cambiar el tipo de contenido reemplaza los campos por el constructor adecuado sin mostrar controles ajenos. Cada formulario se entiende sin conocimientos técnicos, tiene una previsualización coherente con lo que verá el alumno y hace evidente la acción para crear o guardar.
