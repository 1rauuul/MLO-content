import type {
  ActivityType,
  CoreCourse,
  ExerciseConfig,
  ExerciseExample,
  ExerciseStep,
  ExerciseType,
} from "./model";

export type ExerciseInput = {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
};

export type ExampleInput = {
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
};

type Parsed<T> = { value: T } | { error: string };
type Options = { strict?: boolean; normalize?: boolean };

const EXERCISE_TYPES: ExerciseType[] = ["order", "fill", "match", "crossword"];
const ACTIVITY_TYPES: ActivityType[] = [...EXERCISE_TYPES, "mcq"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : ""));
}

function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === "string" && EXERCISE_TYPES.includes(value as ExerciseType);
}

function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && ACTIVITY_TYPES.includes(value as ActivityType);
}

function assertOrder(items: string[], label: string): string | null {
  if (items.length < 2) return `${label}: agrega al menos 2 elementos.`;
  if (items.some((item) => !item)) return `${label}: hay un elemento vacío.`;
  if (new Set(items).size !== items.length) return `${label}: hay elementos repetidos.`;
  return null;
}

function parseSteps(raw: unknown, opts: Options): Parsed<ExerciseStep[]> {
  if (!Array.isArray(raw)) return { error: "Los pasos deben ser una lista." };

  const steps: ExerciseStep[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      return { error: "Un paso tiene formato inválido." };
    }
    const textValue = text(item.text);
    const why = text(item.why);
    if (!textValue && !why && !opts.strict) continue;
    if (!textValue || !why) {
      return { error: "Cada paso necesita texto y explicación." };
    }
    steps.push({ text: textValue, why });
  }

  if (steps.length === 0) return { error: "Agrega al menos un paso." };
  return { value: steps };
}

function parseHints(raw: unknown, opts: Options): Parsed<string[]> {
  if (raw === undefined || raw === null) {
    return opts.strict ? { error: "Las pistas deben ser una lista." } : { value: [] };
  }
  if (!Array.isArray(raw)) return { error: "Las pistas deben ser una lista." };
  const hints = list(raw);
  if (opts.strict && hints.some((hint) => !hint)) {
    return { error: "Hay una pista vacía." };
  }
  return { value: hints.filter(Boolean) };
}

function parseExampleBlock(raw: unknown, opts: Options): Parsed<ExerciseExample | null> {
  if (raw === undefined || raw === null) return { value: null };
  if (!isRecord(raw)) return { error: "El ejemplo tiene formato inválido." };

  const title = text(raw.title);
  if (!title) return { error: "El ejemplo necesita un título." };

  const steps = parseSteps(raw.steps, opts);
  if ("error" in steps) return steps;
  const hints = parseHints(raw.hints, opts);
  if ("error" in hints) return hints;

  return { value: { title, steps: steps.value, hints: hints.value } };
}

function parsePairs(raw: unknown, opts: Options): Parsed<ExerciseConfig> {
  if (!Array.isArray(raw)) return { error: "Los pares deben ser una lista." };

  const pairs: { left: string; right: string }[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return { error: "Un par tiene formato inválido." };
    const left = text(item.left);
    const right = text(item.right);
    if (!left && !right && !opts.strict) continue;
    if (!left || !right) return { error: "Cada par necesita izquierda y derecha." };
    if (pairs.some((pair) => pair.left === left || pair.right === right)) {
      return { error: `Par repetido: ${left} / ${right}.` };
    }
    pairs.push({ left, right });
  }

  if (pairs.length < 2) return { error: "Agrega al menos 2 pares." };
  return { value: { pairs } };
}

function parseCrossword(raw: unknown, opts: Options): Parsed<ExerciseConfig> {
  if (!isRecord(raw)) return { error: "El crucigrama tiene formato inválido." };
  const rows = Number(raw.rows);
  const cols = Number(raw.cols);
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    return { error: "El crucigrama necesita filas y columnas positivas." };
  }

  if (!Array.isArray(raw.entries)) {
    return { error: "El crucigrama necesita entradas." };
  }

  const entries: NonNullable<ExerciseConfig["crossword"]>["entries"] = [];
  const letters = new Map<string, string>();

  for (const item of raw.entries) {
    if (!isRecord(item)) return { error: "Una entrada tiene formato inválido." };
    const originalWord = text(item.word);
    const clue = text(item.clue);
    if (!originalWord && !clue && !opts.strict) continue;
    const word = opts.normalize ? originalWord.toUpperCase() : originalWord;
    if (!clue) return { error: `La entrada ${word || "(sin palabra)"} necesita pista.` };
    if (!/^[A-ZÑ]+$/.test(word)) {
      return { error: `Palabra de crucigrama inválida: ${word || "(vacía)"}.` };
    }

    const row = Number(item.row);
    const col = Number(item.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) {
      return { error: `Posición inválida para ${word}.` };
    }
    const direction = item.direction;
    if (direction !== "across" && direction !== "down") {
      return { error: `Dirección inválida para ${word}.` };
    }

    const stepRow = direction === "down" ? 1 : 0;
    const stepCol = direction === "across" ? 1 : 0;
    for (let offset = 0; offset < word.length; offset += 1) {
      const cellRow = row + stepRow * offset;
      const cellCol = col + stepCol * offset;
      if (cellRow >= rows || cellCol >= cols) {
        return { error: `${word} se sale de la cuadrícula.` };
      }
      const key = `${cellRow}-${cellCol}`;
      const letter = word[offset];
      const existing = letters.get(key);
      if (existing !== undefined && existing !== letter) {
        return { error: `${word} choca en el cruce ${cellRow}-${cellCol}.` };
      }
      letters.set(key, letter);
    }

    entries.push({ word, clue, row, col, direction });
  }

  if (entries.length === 0) return { error: "Agrega al menos una entrada." };
  if (letters.size === 0) return { error: "El crucigrama no tiene celdas." };

  const bank = list(raw.bank ?? [])
    .filter(Boolean)
    .map((word) => (opts.normalize ? word.toUpperCase() : word));

  return { value: { crossword: { rows, cols, entries }, bank } };
}

function parseConfig(type: ExerciseType, raw: unknown, opts: Options): Parsed<ExerciseConfig> {
  if (type === "order") return { value: {} };
  const config = isRecord(raw) ? raw : {};

  if (type === "fill") {
    if (!Array.isArray(config.sentences)) {
      return { error: "Completar necesita oraciones." };
    }
    const sentences: string[] = [];
    for (const item of config.sentences) {
      if (typeof item !== "string") {
        if (opts.strict) return { error: "Una oración no es texto." };
        continue;
      }
      const sentence = item.trim();
      if (!sentence && !opts.strict) continue;
      if (!sentence) return { error: "Hay una oración vacía." };
      const matches = [...sentence.matchAll(/\{\{(.+?)\}\}/g)];
      if (matches.length === 0 || matches.some((match) => !match[1].trim())) {
        return { error: `La oración necesita un espacio {{…}} válido: ${sentence}` };
      }
      sentences.push(sentence);
    }
    if (sentences.length === 0) return { error: "Agrega al menos una oración." };
    if (opts.strict && !Array.isArray(config.bank)) {
      return { error: "El banco de palabras debe ser una lista." };
    }
    return { value: { sentences, bank: list(config.bank).filter(Boolean) } };
  }

  if (type === "match") {
    return parsePairs(config.pairs, opts);
  }

  return parseCrossword(config.crossword, opts);
}

export function parseExerciseInput(raw: unknown, opts: Options = {}): Parsed<ExerciseInput> {
  if (!isRecord(raw)) return { error: "El ejercicio tiene formato inválido." };
  if (!isExerciseType(raw.type)) return { error: "Elige un tipo de ejercicio válido." };

  const prompt = text(raw.prompt);
  if (!prompt) return { error: "Escribe el enunciado." };
  const instructions = text(raw.instructions);
  const explanation = text(raw.explanation);

  let correctOrder: string[] = [];
  if (raw.type === "order") {
    const values = list(raw.correctOrder);
    correctOrder = opts.strict ? values : values.filter(Boolean);
    const orderError = assertOrder(correctOrder, "Orden");
    if (orderError) return { error: orderError };
  }

  const config = parseConfig(raw.type, raw.config, opts);
  if ("error" in config) return config;

  const example = parseExampleBlock(raw.example, opts);
  if ("error" in example) return example;

  return {
    value: {
      type: raw.type,
      prompt,
      instructions,
      correctOrder,
      config: config.value,
      explanation,
      example: example.value,
    },
  };
}

export function parseExampleInput(raw: unknown, opts: Options = {}): Parsed<ExampleInput> {
  if (!isRecord(raw)) return { error: "El ejemplo tiene formato inválido." };
  if (!isExerciseType(raw.type)) return { error: "Elige un tipo de ejemplo válido." };
  if (raw.type === "order") {
    return {
      error: "Un ejemplo independiente no puede ser de ordenar: usa un ejercicio con ejemplo.",
    };
  }

  const title = text(raw.title);
  if (!title) return { error: "Escribe el título del ejemplo." };
  const prompt = text(raw.prompt);
  if (!prompt) return { error: "Escribe el enunciado del ejemplo." };
  const explanation = text(raw.explanation);

  const config = parseConfig(raw.type, raw.config, opts);
  if ("error" in config) return config;

  const steps = parseSteps(raw.steps, opts);
  if ("error" in steps) return steps;

  const hints = parseHints(raw.hints, opts);
  if ("error" in hints) return hints;

  return {
    value: {
      type: raw.type,
      title,
      prompt,
      config: config.value,
      steps: steps.value,
      hints: hints.value,
      explanation,
    },
  };
}

function validateBlocks(content: unknown, lessonId: string): void {
  if (!Array.isArray(content)) {
    throw new Error(`Lección ${lessonId}: el contenido no es una lista.`);
  }
  for (const [index, block] of content.entries()) {
    const where = `Lección ${lessonId}, bloque ${index + 1}`;
    if (!isRecord(block) || typeof block.type !== "string") {
      throw new Error(`${where}: bloque inválido.`);
    }
    if (block.type === "p" || block.type === "h") {
      if (!text(block.text)) throw new Error(`${where}: texto vacío.`);
      continue;
    }
    if (block.type === "bullets" || block.type === "numbers") {
      if (!Array.isArray(block.items) || block.items.length === 0) {
        throw new Error(`${where}: lista vacía.`);
      }
      if (block.items.some((item) => !text(item))) {
        throw new Error(`${where}: elemento vacío.`);
      }
      continue;
    }
    if (block.type === "table") {
      if (!Array.isArray(block.header) || block.header.length === 0) {
        throw new Error(`${where}: tabla sin encabezados.`);
      }
      if (!Array.isArray(block.rows) || block.rows.length === 0) {
        throw new Error(`${where}: tabla sin filas.`);
      }
      if (block.header.some((cell) => !text(cell))) {
        throw new Error(`${where}: encabezado vacío.`);
      }
      for (const row of block.rows) {
        if (!Array.isArray(row) || row.length !== block.header.length) {
          throw new Error(`${where}: fila con columnas distintas.`);
        }
        if (row.some((cell) => !text(cell))) {
          throw new Error(`${where}: celda vacía.`);
        }
      }
      continue;
    }
    throw new Error(`${where}: tipo desconocido.`);
  }
}

function validateQuestion(question: CoreCourse["questions"][number]): void {
  const where = `Pregunta ${question.content_id}`;
  if (!isActivityType(question.type)) throw new Error(`${where}: tipo inválido.`);
  if (!text(question.prompt)) throw new Error(`${where}: enunciado vacío.`);

  if (question.type === "mcq") {
    const options = list(question.options);
    if (options.length < 2) throw new Error(`${where}: necesita al menos 2 opciones.`);
    if (options.some((option) => !option)) throw new Error(`${where}: opción vacía.`);
    if (new Set(options).size !== options.length) {
      throw new Error(`${where}: opciones repetidas.`);
    }
    if (
      !Number.isInteger(question.answer) ||
      question.answer < 0 ||
      question.answer >= options.length
    ) {
      throw new Error(`${where}: respuesta fuera de rango.`);
    }
    return;
  }

  if (question.type === "order") {
    const orderError = assertOrder(list(question.options), `Pregunta ${question.content_id}`);
    if (orderError) throw new Error(orderError);
    if (question.answer !== 0) throw new Error(`${where}: answer debe ser 0.`);
    return;
  }

  const config = parseConfig(question.type, question.config, { strict: true });
  if ("error" in config) throw new Error(`${where}: ${config.error}`);
}

/** Valida todo el catálogo antes de crear un release. */
export function validateCatalogForPublish(course: CoreCourse): void {
  for (const lesson of course.lessons) {
    validateBlocks(lesson.content, lesson.content_id);
  }

  for (const exercise of course.exercises) {
    const parsed = parseExerciseInput(
      {
        type: exercise.type,
        prompt: exercise.prompt,
        instructions: exercise.instructions,
        correctOrder: exercise.correct_order,
        config: exercise.config,
        explanation: exercise.explanation,
        example: exercise.example,
      },
      { strict: true },
    );
    if ("error" in parsed) throw new Error(`Ejercicio ${exercise.content_id}: ${parsed.error}`);
  }

  for (const example of course.examples) {
    const parsed = parseExampleInput(
      {
        type: example.type,
        title: example.title,
        prompt: example.prompt,
        config: example.config,
        steps: example.steps,
        hints: example.hints,
        explanation: example.explanation,
      },
      { strict: true },
    );
    if ("error" in parsed) throw new Error(`Ejemplo ${example.content_id}: ${parsed.error}`);
  }

  for (const evaluation of course.evaluations) {
    if (
      !Number.isInteger(evaluation.question_count) ||
      evaluation.question_count <= 0 ||
      !Number.isInteger(evaluation.exercise_count) ||
      evaluation.exercise_count <= 0
    ) {
      throw new Error(`Evaluación ${evaluation.content_id}: cantidades inválidas.`);
    }
  }

  for (const question of course.questions) {
    validateQuestion(question);
  }
}
