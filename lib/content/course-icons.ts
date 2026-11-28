export const COURSE_ICON_GROUPS = [
  "Generales",
  "Teoría de la Computación",
  "Inteligencia Artificial",
  "Sistemas de Cómputo",
  "Sistemas de Información",
] as const;

export type CourseIconGroup = (typeof COURSE_ICON_GROUPS)[number];

/**
 * Catálogo de iconos de curso del CMS. Las claves se guardan en `courses.icon`
 * y las comparte MLO: no renombrar una clave sin actualizar ambos repos.
 */
export const COURSE_ICONS = [
  // Generales
  { key: "code", label: "Código", group: "Generales", kind: "image", tone: "line" },
  { key: "module", label: "Módulos", group: "Generales", kind: "svg" },
  { key: "book", label: "Lectura", group: "Generales", kind: "svg" },
  { key: "lesson", label: "Lecciones", group: "Generales", kind: "svg" },
  { key: "examples", label: "Ejemplos", group: "Generales", kind: "svg" },
  { key: "exercises", label: "Práctica", group: "Generales", kind: "svg" },
  { key: "eval", label: "Evaluación", group: "Generales", kind: "svg" },
  { key: "clock", label: "Tiempo", group: "Generales", kind: "svg" },
  { key: "info", label: "Fundamentos", group: "Generales", kind: "svg" },
  { key: "tile", label: "General", group: "Generales", kind: "svg" },
  { key: "user", label: "Personas", group: "Generales", kind: "svg" },
  { key: "home", label: "Inicio", group: "Generales", kind: "svg" },
  { key: "checklist", label: "Checklist", group: "Generales", kind: "image", tone: "color" },
  { key: "graduation", label: "Académico", group: "Generales", kind: "image", tone: "line" },

  // Teoría de la Computación
  { key: "algorithm", label: "Algoritmos", group: "Teoría de la Computación", kind: "svg" },
  { key: "math", label: "Matemáticas", group: "Teoría de la Computación", kind: "svg" },
  { key: "game", label: "Teoría de juegos", group: "Teoría de la Computación", kind: "svg" },

  // Inteligencia Artificial
  { key: "ai", label: "Inteligencia Artificial", group: "Inteligencia Artificial", kind: "image", tone: "color" },
  { key: "brain", label: "Aprendizaje", group: "Inteligencia Artificial", kind: "image", tone: "line" },
  { key: "robot", label: "Agentes", group: "Inteligencia Artificial", kind: "svg" },
  { key: "nlp", label: "Lenguaje natural", group: "Inteligencia Artificial", kind: "svg" },

  // Sistemas de Cómputo
  { key: "chip", label: "Arquitectura", group: "Sistemas de Cómputo", kind: "svg" },
  { key: "network", label: "Redes", group: "Sistemas de Cómputo", kind: "image", tone: "color" },
  { key: "cloud", label: "Distribuidos", group: "Sistemas de Cómputo", kind: "svg" },
  { key: "mobile", label: "Móvil", group: "Sistemas de Cómputo", kind: "svg" },

  // Sistemas de Información
  { key: "database", label: "Datos", group: "Sistemas de Información", kind: "svg" },
  { key: "software", label: "Ingeniería de Software", group: "Sistemas de Información", kind: "image", tone: "line" },
  { key: "security", label: "Seguridad", group: "Sistemas de Información", kind: "svg" },
  { key: "graphics", label: "Graficación", group: "Sistemas de Información", kind: "svg" },
  { key: "chart", label: "Analítica", group: "Sistemas de Información", kind: "svg" },
] as const;

export type CourseIconDefinition = (typeof COURSE_ICONS)[number];
export type CourseIconKey = CourseIconDefinition["key"];

export const DEFAULT_COURSE_ICON: CourseIconKey = "code";

export function isCourseIcon(value: string): value is CourseIconKey {
  return COURSE_ICONS.some((icon) => icon.key === value);
}
