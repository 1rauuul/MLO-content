import type { ExerciseConfig, ExerciseStep, ExerciseType } from "./model";

export type ActivitySample = {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
};

export type ExampleSample = ActivitySample & {
  title: string;
  steps: ExerciseStep[];
  hints: string[];
};

/**
 * Muestras reales del editor. `validate.test.ts` las pasa por las mismas
 * reglas estrictas de publicación para que nunca se separen de MLO.
 */
export const EXERCISE_SAMPLES: Record<ExerciseType, ActivitySample> = {
  order: {
    type: "order",
    prompt: "Ordena las fases del ciclo de vida del software.",
    instructions: "Coloca cada fase en el orden en que ocurre en un proyecto.",
    correctOrder: ["Análisis de requisitos", "Diseño", "Implementación", "Pruebas"],
    config: {},
    explanation:
      "Primero se define qué se necesita, después cómo se construye, luego se implementa y al final se verifica.",
  },
  fill: {
    type: "fill",
    prompt: "Completa las oraciones con la palabra correcta.",
    instructions: "Elige una palabra del banco para cada espacio.",
    correctOrder: [],
    config: {
      sentences: [
        "El {{software}} se mantiene y evoluciona con el tiempo.",
        "La {{ingeniería}} de requisitos define qué debe hacer el sistema.",
      ],
      bank: ["hardware", "diseño"],
    },
    explanation:
      "El software es el producto lógico; la ingeniería de requisitos es la disciplina que lo especifica.",
  },
  match: {
    type: "match",
    prompt: "Relaciona cada concepto con su definición.",
    instructions: "Selecciona la definición que corresponde a cada concepto.",
    correctOrder: [],
    config: {
      pairs: [
        { left: "Requisito funcional", right: "Qué debe hacer el sistema" },
        { left: "Requisito no funcional", right: "Cómo debe comportarse el sistema" },
        { left: "Trazabilidad", right: "Seguir un requisito hasta su origen" },
      ],
    },
    explanation:
      "Los requisitos funcionales describen comportamientos; los no funcionales, cualidades; la trazabilidad conecta cada requisito con su origen y su implementación.",
  },
  crossword: {
    type: "crossword",
    prompt: "Completa el crucigrama con conceptos de ingeniería de software.",
    instructions: "Lee las pistas y escribe una letra por casilla.",
    correctOrder: [],
    config: {
      crossword: {
        rows: 5,
        cols: 5,
        entries: [
          { word: "SOL", clue: "Estrella del sistema solar", row: 0, col: 0, direction: "across" },
          { word: "SAL", clue: "Condimento blanco", row: 0, col: 0, direction: "down" },
          { word: "OLA", clue: "Movimiento del mar", row: 2, col: 1, direction: "across" },
        ],
      },
      bank: [],
    },
    explanation:
      "Las tres palabras comparten letras en la cuadrícula: las respuestas se confirman entre sí.",
  },
};

export const EXAMPLE_SAMPLES: Record<ExerciseType, ExampleSample> = {
  order: {
    ...EXERCISE_SAMPLES.order,
    title: "El ciclo de vida en orden",
    steps: [
      {
        text: "Identifica la primera actividad: definir qué se necesita.",
        why: "Sin requisitos no hay una base para diseñar.",
      },
      {
        text: "Continúa con diseño, implementación y pruebas.",
        why: "Cada fase usa el resultado de la anterior.",
      },
    ],
    hints: ["Piensa qué ocurre antes de escribir código."],
  },
  fill: {
    ...EXERCISE_SAMPLES.fill,
    title: "Completar con el contexto",
    steps: [
      {
        text: "Lee la oración completa y pregunta qué falta.",
        why: "El contexto descarta las opciones que no encajan.",
      },
      {
        text: "Descarta primero las palabras que no encajan gramaticalmente.",
        why: "El banco incluye respuestas correctas y distractores.",
      },
    ],
    hints: ["Fíjate en el artículo que acompaña al espacio."],
  },
  match: {
    ...EXERCISE_SAMPLES.match,
    title: "Relacionar concepto y definición",
    steps: [
      {
        text: "Lee primero las definiciones de la derecha.",
        why: "Reconocer el tipo de definición reduce las opciones.",
      },
      {
        text: "Une cada concepto con la definición que lo describe.",
        why: "Los requisitos no funcionales hablan de cualidades, no de acciones.",
      },
    ],
    hints: ["Descarta las definiciones que ya usaste."],
  },
  crossword: {
    ...EXERCISE_SAMPLES.crossword,
    title: "Crucigrama de conceptos",
    steps: [
      {
        text: "Resuelve primero la pista que cruza con otra palabra.",
        why: "Las letras compartidas confirman la respuesta.",
      },
      {
        text: "Cuenta las casillas disponibles antes de escribir.",
        why: "El tamaño de la palabra descarta respuestas posibles.",
      },
    ],
    hints: ["Empieza por la pista cuya respuesta conoces con seguridad."],
  },
};
