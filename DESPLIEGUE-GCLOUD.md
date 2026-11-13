# Propuesta de despliegue — MLO Maestros en Google Cloud

## Objetivo

Hospedar el CMS de maestros, su API para MLO y PostgreSQL en Google Cloud, con una
operación administrada, secretos fuera del repositorio y capacidad para enviar
invitaciones por correo.

## Arquitectura propuesta

```text
Navegador del maestro / App MLO
              │ HTTPS
              ▼
Cloud Run
  └─ Next.js: panel CMS + API /api/mlo
              │ conexión administrada
              ▼
Cloud SQL for PostgreSQL

Cloud Run ──► Proveedor de correo / SMTP institucional
              │
              ├─ Secret Manager: contraseñas, URLs y API keys
              └─ Cloud Logging / Monitoring: registros y alertas
```

## Servicios de Google Cloud

| Necesidad | Servicio propuesto | Responsabilidad |
|---|---|---|
| Aplicación web y API | Cloud Run | Ejecutar Next.js, el panel y la API que consume MLO. |
| Base de datos | Cloud SQL for PostgreSQL | Persistir cuentas, sesiones, cursos, grupos, releases e invitaciones. |
| Secretos | Secret Manager | Guardar credenciales de BD, claves del proveedor de correo y variables de producción. |
| Imágenes de despliegue | Artifact Registry | Almacenar la imagen de contenedor generada en cada despliegue. |
| Construcción / CI | Cloud Build o GitHub Actions | Ejecutar pruebas, construir y publicar la aplicación. |
| Observabilidad | Cloud Logging y Cloud Monitoring | Registrar errores, métricas y alertas. |
| Archivos futuros | Cloud Storage | Guardar recursos multimedia si el producto los incorpora más adelante. |
| Envío diferido de correo | Cloud Tasks (recomendado) | Reintentar invitaciones sin bloquear la acción del maestro. |

## Aplicación: Cloud Run

- Desplegar el proyecto Next.js como un único servicio de Cloud Run.
- Mantener panel y API en el mismo servicio: las rutas `/api/mlo/...` seguirán
  siendo públicas para MLO y las rutas del panel conservarán su sesión propia.
- Elegir una única región y colocar Cloud Run, Cloud SQL, Artifact Registry y
  Cloud Storage en esa misma región.
- Configurar un dominio propio para el CMS; las invitaciones usarán ese dominio
  para sus enlaces profundos hacia MLO.
- Establecer una instancia mínima solo si se requiere evitar arranques en frío;
  de lo contrario, permitir escala a cero en ambientes de desarrollo.

Google Cloud mantiene una guía oficial para desplegar Next.js en Cloud Run:
[Deploy a Next.js web app to Cloud Run](https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service).

## Base de datos: Cloud SQL for PostgreSQL

- Crear una instancia administrada de **Cloud SQL for PostgreSQL**.
- Usar una base separada para producción y otra para desarrollo/pruebas.
- Activar respaldos automáticos y recuperación a un momento determinado de acuerdo
  con la política institucional de retención.
- Crear un usuario de aplicación con permisos limitados; no usar el superusuario
  de la base desde Cloud Run.
- Ejecutar las migraciones mediante un job o paso controlado de despliegue, no al
  inicio de cada instancia de Cloud Run.
- Configurar límites de conexiones/pooling acordes a Cloud Run. Las instancias de
  Cloud Run pueden escalar, por lo que la aplicación no debe abrir conexiones sin
  límite a PostgreSQL.

Cloud SQL es PostgreSQL administrado y Cloud Run puede conectarse mediante la
integración administrada de Cloud SQL. Referencias oficiales:
[Cloud SQL for PostgreSQL](https://cloud.google.com/sql/postgresql) y
[Connect Cloud Run to Cloud SQL for PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/connect-run).

## Conectividad y permisos

1. Usar una cuenta de servicio dedicada para Cloud Run.
2. Concederle únicamente `Cloud SQL Client` para la conexión a la base y acceso de
   lectura a los secretos que realmente utiliza.
3. Conectar Cloud Run a Cloud SQL mediante la conexión administrada de Cloud SQL.
4. Para producción, preferir base con IP privada y salida de Cloud Run por Direct
   VPC egress si la política de red institucional lo requiere.
5. Mantener la base sin acceso público salvo necesidad operativa explícita.
6. Limitar CORS de la API a los orígenes que realmente lo necesitan; MLO nativo no
   depende de CORS, pero Expo web sí puede requerirlo.

## Secretos y configuración

Ningún secreto vive en Git ni en `.env.local` de producción. Secret Manager debe
contener, como mínimo:

```text
DATABASE_URL
DATABASE_URL_DIRECT (solo para migraciones controladas)
SESSION_SECRET / claves de firma de invitaciones
EMAIL_PROVIDER_API_KEY (Resend)
EMAIL_FROM
APP_BASE_URL
MLO_DEEP_LINK_BASE
```

Cloud Run recibe estos valores como secretos o variables de entorno referenciadas
desde Secret Manager.

## Invitaciones por correo

- El CMS genera una invitación con token opaco, de un solo uso y con vencimiento
  mínimo de 48 horas.
- El correo contiene un enlace profundo para abrir MLO y un código de invitación de
  respaldo distinto del código público del grupo.
- MLO envía su identidad local estable al aceptar el enlace o código; el servidor
  valida el token y crea la membresía del alumno.
- El envío no debe bloquear al maestro: Cloud Tasks puede ejecutar reintentos ante
  errores temporales del proveedor de correo.
- El proveedor de correo puede ser SMTP institucional, Resend, SendGrid u otro que
  la institución apruebe; la decisión se mantiene desacoplada del CMS mediante
  configuración y un adaptador de envío.
- Implementación actual: Resend por HTTP. Requiere `EMAIL_PROVIDER_API_KEY` y un
  `EMAIL_FROM` verificado. Si faltan, la invitación se crea igual y el panel muestra
  el enlace para compartirlo manualmente.

## Flujo de despliegue

```text
Pull request
   ↓
Pruebas: test + lint + build
   ↓
Construcción de imagen / Artifact Registry
   ↓
Migración controlada de Cloud SQL
   ↓
Nueva revisión de Cloud Run
   ↓
Verificación HTTP y monitoreo
```

Recomendación de ambientes:

| Ambiente | Uso |
|---|---|
| Desarrollo | Integración local y pruebas de migraciones. |
| Staging | Pruebas reales de API, correo e invitaciones con APK `hybrid`. |
| Producción | Usuarios finales, dominio propio, alertas y respaldos. |

## Operación y seguridad

- Configurar alertas por errores 5xx, fallos de conexión a la base y errores de
  envío de invitaciones.
- Registrar eventos relevantes: publicación de curso/grupo, emisión y aceptación
  de invitación, y fallos de validación de release.
- Rotar credenciales y claves de firma de forma documentada.
- Aplicar rate limiting en endpoints públicos, especialmente invitaciones,
  aceptación por código y endpoints de lectura de releases.
- Probar restauración de respaldos de Cloud SQL antes de liberar a producción.
- Establecer presupuestos y alertas de costo en el proyecto de Google Cloud.

## Decisiones pendientes antes de la liberación

1. Región de GCP y dominio institucional.
2. Proveedor de correo autorizado y remitente oficial.
3. Política de retención de respaldos y datos de alumnos.
4. Si la base usará IP privada obligatoria.
5. Quién administra IAM, facturación y los secretos de producción.
6. Perfil de Cloud Run para producción: escala mínima, límites de CPU/memoria y
   concurrencia, definidos después de pruebas de carga.
