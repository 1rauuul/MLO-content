import { hashValue } from "./hash";

/*
 * Validador del contrato v3 (DEC-01). No importa el modelo ni la composición
 * v2: solo reutiliza la canonicalización compartida de hash.ts, como exige DEC-01.
 */
export type ReleaseV3 = {
  schemaVersion: 3;
  kind: "course" | "group";
  hash: string;
  [key: string]: unknown;
};

export type ValidationResult =
  | { ok: true; release: ReleaseV3 }
  | { ok: false; error: string };

class Invalid extends Error {}

function fail(message: string): never {
  throw new Invalid(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${where}: se esperaba un objeto.`);
  return value;
}

function records(value: unknown, where: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) fail(`${where}: se esperaba una lista.`);
  return value.map((item, index) => record(item, `${where}[${index}]`));
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${where}: texto requerido.`);
  return value;
}

function optionalText(value: unknown, where: string): string {
  if (typeof value !== "string") fail(`${where}: se esperaba texto.`);
  return value;
}

function integer(value: unknown, where: string, min: number): number {
  if (!Number.isInteger(value) || (value as number) < min) {
    fail(`${where}: se esperaba un entero >= ${min}.`);
  }
  return value as number;
}

function choice<T extends string>(value: unknown, options: readonly T[], where: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    fail(`${where}: valor inválido (${JSON.stringify(value)}).`);
  }
  return value as T;
}

function textList(value: unknown, where: string): string[] {
  if (!Array.isArray(value)) fail(`${where}: se esperaba una lista de textos.`);
  return value.map((item, index) => optionalText(item, `${where}[${index}]`));
}

function iso(value: unknown, where: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    fail(`${where}: se esperaba una fecha ISO-8601 UTC.`);
  }
  return value;
}

function sha256(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${where}: se esperaba un sha256 en hex minúsculas.`);
  }
  return value;
}

function addId(ids: Set<string>, value: unknown, where: string): string {
  const id = text(value, where);
  if (ids.has(id)) fail(`Id duplicado: ${id} (${where}).`);
  ids.add(id);
  return id;
}

function unique(ids: string[], where: string): void {
  if (new Set(ids).size !== ids.length) fail(`${where}: hay elementos repetidos.`);
}

function assertSequence(items: string[], where: string): void {
  if (items.length < 2) fail(`${where}: se necesitan al menos 2 elementos.`);
  items.forEach((item, index) => text(item, `${where}[${index}]`));
  unique(items, where);
}

const DIFFICULTIES = ["Fundamental", "Intermedio", "Avanzado"] as const;
const COLORS = ["blue", "violet", "green"] as const;
const EXERCISE_TYPES = ["order", "fill", "match", "crossword"] as const;
const ACTIVITY_TYPES = [...EXERCISE_TYPES, "mcq"] as const;
const EXAMPLE_TYPES = ["fill", "match", "crossword"] as const;
const COURSE_VISIBILITY = ["published", "unpublished"] as const;
const GROUP_VISIBILITY = ["published", "unpublished"] as const;

function parseBlocks(value: unknown, where: string): void {
  const blocks = records(value, where);
  blocks.forEach((block, index) => {
    const at = `${where}[${index}]`;
    const type = block.type;
    if (type === "p" || type === "h") {
      text(block.text, `${at}.text`);
      return;
    }
    if (type === "bullets" || type === "numbers") {
      const items = textList(block.items, `${at}.items`);
      if (items.length === 0) fail(`${at}: lista vacía.`);
      items.forEach((item, itemIndex) => text(item, `${at}.items[${itemIndex}]`));
      return;
    }
    if (type === "table") {
      const header = textList(block.header, `${at}.header`);
      if (header.length === 0) fail(`${at}: tabla sin encabezados.`);
      header.forEach((cell, cellIndex) => text(cell, `${at}.header[${cellIndex}]`));
      const rows = block.rows;
      if (!Array.isArray(rows)) fail(`${at}.rows: se esperaba una lista.`);
      if (rows.length === 0) fail(`${at}: tabla sin filas.`);
      rows.forEach((row, rowIndex) => {
        const cells = textList(row, `${at}.rows[${rowIndex}]`);
        if (cells.length !== header.length) {
          fail(`${at}: la fila ${rowIndex + 1} tiene ${cells.length} celdas; se esperaban ${header.length}.`);
        }
        cells.forEach((cell, cellIndex) => text(cell, `${at}.rows[${rowIndex}][${cellIndex}]`));
      });
      return;
    }
    fail(`${at}: tipo de bloque desconocido (${JSON.stringify(type)}).`);
  });
}

function parseSteps(value: unknown, where: string): void {
  const steps = records(value, where);
  if (steps.length === 0) fail(`${where}: agrega al menos un paso.`);
  steps.forEach((step, index) => {
    text(step.text, `${where}[${index}].text`);
    text(step.why, `${where}[${index}].why`);
  });
}

function parseConfig(type: string, value: unknown, where: string): void {
  if (type === "order") return;
  const config = record(value, `${where}.config`);

  if (type === "fill") {
    const sentences = textList(config.sentences, `${where}.config.sentences`);
    if (sentences.length === 0) fail(`${where}: agrega al menos una oración.`);
    sentences.forEach((sentence, index) => {
      const holes = [...sentence.matchAll(/\{\{(.+?)\}\}/g)];
      if (holes.length === 0 || holes.some((hole) => !hole[1].trim())) {
        fail(`${where}.config.sentences[${index}]: falta un hueco {{…}} válido.`);
      }
    });
    textList(config.bank, `${where}.config.bank`);
    return;
  }

  if (type === "match") {
    const pairs = records(config.pairs, `${where}.config.pairs`);
    if (pairs.length < 2) fail(`${where}.config.pairs: se necesitan al menos 2 pares.`);
    const lefts = new Set<string>();
    const rights = new Set<string>();
    pairs.forEach((pair, index) => {
      const left = text(pair.left, `${where}.config.pairs[${index}].left`);
      const right = text(pair.right, `${where}.config.pairs[${index}].right`);
      if (lefts.has(left) || rights.has(right)) {
        fail(`${where}.config.pairs[${index}]: par repetido (${left} / ${right}).`);
      }
      lefts.add(left);
      rights.add(right);
    });
    return;
  }

  const crossword = record(config.crossword, `${where}.config.crossword`);
  const rows = integer(crossword.rows, `${where}.config.crossword.rows`, 1);
  const cols = integer(crossword.cols, `${where}.config.crossword.cols`, 1);
  const entries = records(crossword.entries, `${where}.config.crossword.entries`);
  if (entries.length === 0) fail(`${where}.config.crossword.entries: agrega al menos una entrada.`);

  const letters = new Map<string, string>();
  entries.forEach((entry, index) => {
    const at = `${where}.config.crossword.entries[${index}]`;
    const word = text(entry.word, `${at}.word`);
    text(entry.clue, `${at}.clue`);
    if (!/^[A-ZÑ]+$/.test(word)) {
      fail(`${at}.word: solo se admite A-Z y Ñ (${word}).`);
    }
    const row = integer(entry.row, `${at}.row`, 0);
    const col = integer(entry.col, `${at}.col`, 0);
    const direction = choice(entry.direction, ["across", "down"] as const, `${at}.direction`);
    const stepRow = direction === "down" ? 1 : 0;
    const stepCol = direction === "across" ? 1 : 0;
    for (let offset = 0; offset < word.length; offset += 1) {
      const cellRow = row + stepRow * offset;
      const cellCol = col + stepCol * offset;
      if (cellRow >= rows || cellCol >= cols) {
        fail(`${at}: ${word} se sale de la cuadrícula.`);
      }
      const key = `${cellRow}-${cellCol}`;
      const current = letters.get(key);
      if (current !== undefined && current !== word[offset]) {
        fail(`${at}: ${word} choca en el cruce ${cellRow}-${cellCol}.`);
      }
      letters.set(key, word[offset]);
    }
  });

  if (config.bank !== undefined) textList(config.bank, `${where}.config.bank`);
}

function parseEmbeddedExample(value: unknown, where: string): void {
  if (value === null) return;
  if (value === undefined) fail(`${where}: es obligatorio (objeto o null).`);
  const example = record(value, where);
  text(example.title, `${where}.title`);
  parseSteps(example.steps, `${where}.steps`);
  if (example.hints !== undefined) textList(example.hints, `${where}.hints`);
}

function parseExercise(value: unknown, where: string): Record<string, unknown> {
  const exercise = record(value, where);
  const type = choice(exercise.type, EXERCISE_TYPES, `${where}.type`);
  text(exercise.prompt, `${where}.prompt`);
  optionalText(exercise.instructions, `${where}.instructions`);
  const correctOrder = textList(exercise.correctOrder, `${where}.correctOrder`);
  if (type === "order") assertSequence(correctOrder, `${where}.correctOrder`);
  parseConfig(type, exercise.config, where);
  optionalText(exercise.explanation, `${where}.explanation`);
  parseEmbeddedExample(exercise.example, `${where}.example`);
  return exercise;
}

function parseExample(value: unknown, where: string): Record<string, unknown> {
  const example = record(value, where);
  const type = choice(example.type, EXAMPLE_TYPES, `${where}.type`);
  text(example.title, `${where}.title`);
  text(example.prompt, `${where}.prompt`);
  parseConfig(type, example.config, where);
  parseSteps(example.steps, `${where}.steps`);
  textList(example.hints, `${where}.hints`);
  optionalText(example.explanation, `${where}.explanation`);
  return example;
}

function parseReferenceIds(value: unknown, where: string, referenceIds: Set<string>): void {
  if (value === undefined) return;
  const ids = textList(value, where);
  unique(ids, where);
  ids.forEach((id, index) => {
    if (!referenceIds.has(id)) fail(`${where}[${index}]: referencia inexistente (${id}).`);
  });
}

function parseReferences(value: unknown, ids: Set<string>): Set<string> {
  const references = records(value, "references");
  const referenceIds = new Set<string>();
  references.forEach((reference, index) => {
    const id = addId(ids, reference.id, `references[${index}].id`);
    referenceIds.add(id);
    text(reference.text, `Referencia ${id}.text`);
    if (reference.url !== undefined) text(reference.url, `Referencia ${id}.url`);
  });
  return referenceIds;
}

function parseNotices(value: unknown, ids: Set<string>): void {
  const notices = records(value, "notices");
  notices.forEach((notice, index) => {
    const id = addId(ids, notice.id, `notices[${index}].id`);
    text(notice.title, `Aviso ${id}.title`);
    text(notice.body, `Aviso ${id}.body`);
    if (notice.publishedAt !== undefined) iso(notice.publishedAt, `Aviso ${id}.publishedAt`);
    if (typeof notice.active !== "boolean") fail(`Aviso ${id}.active: se esperaba booleano.`);
  });
}

function parseBaseRef(value: unknown): void {
  if (value === null) return;
  if (value === undefined) fail("baseRef: es obligatorio (null si no hay contenido base).");
  const base = record(value, "baseRef");
  text(base.catalogId, "baseRef.catalogId");
  integer(base.version, "baseRef.version", 1);
  sha256(base.hash, "baseRef.hash");
}

function verifyReleaseHash(doc: Record<string, unknown>): void {
  const { hash, ...content } = doc;
  const actual = hashValue(content);
  if (actual !== hash) {
    fail(`hash del release no coincide (declarado ${String(hash)}, calculado ${actual}).`);
  }
}

function validateQuestion(
  question: Record<string, unknown>,
  where: string,
): void {
  const type = choice(question.type, ACTIVITY_TYPES, `${where}.type`);
  text(question.prompt, `${where}.prompt`);
  const options = textList(question.options, `${where}.options`);
  const answer = integer(question.answer, `${where}.answer`, 0);
  record(question.config, `${where}.config`);
  optionalText(question.explanation, `${where}.explanation`);
  integer(question.position, `${where}.position`, 0);

  if (type === "mcq") {
    if (options.length < 2) fail(`${where}: necesita al menos 2 opciones.`);
    options.forEach((option, index) => text(option, `${where}.options[${index}]`));
    unique(options, `${where}.options`);
    if (answer >= options.length) fail(`${where}: respuesta fuera de rango.`);
    return;
  }

  if (type === "order") {
    assertSequence(options, `${where}.options`);
    if (answer !== 0) fail(`${where}: answer debe ser 0.`);
    return;
  }

  if (options.length !== 0) fail(`${where}: options debe ser [] para ${type}.`);
  if (answer !== 0) fail(`${where}: answer debe ser 0 para ${type}.`);
  parseConfig(type, question.config, where);
}

type EvaluationInfo = {
  id: string;
  lessonId: string;
  questionIds: string[];
  exerciseIds: string[];
  raw: Record<string, unknown>;
};

type Scope = "course" | "group";

function parseResources(
  doc: Record<string, unknown>,
  ids: Set<string>,
  referenceIds: Set<string>,
  scope: Scope,
): Set<string> {
  // En grupo se aceptan referencias a recursos del curso; el servidor las
  // resuelve en X-02. En curso toda referencia es interna al release.
  const external = scope === "group";

  const units = records(doc.units, "units");
  const unitIds = new Set<string>();
  units.forEach((unit, index) => {
    const id = addId(ids, unit.id, `units[${index}].id`);
    unitIds.add(id);
    integer(unit.number, `Unidad ${id}.number`, 1);
    optionalText(unit.title, `Unidad ${id}.title`);
    optionalText(unit.description, `Unidad ${id}.description`);
    choice(unit.difficulty, DIFFICULTIES, `Unidad ${id}.difficulty`);
    choice(unit.color, COLORS, `Unidad ${id}.color`);
    integer(unit.position, `Unidad ${id}.position`, 0);
  });

  const topics = records(doc.topics, "topics");
  const topicIds = new Set<string>();
  topics.forEach((topic, index) => {
    const id = addId(ids, topic.id, `topics[${index}].id`);
    topicIds.add(id);
    const unitId = text(topic.unitId, `Subtema ${id}.unitId`);
    if (!unitIds.has(unitId) && !external) {
      fail(`El subtema ${id} apunta a una unidad inexistente: ${unitId}.`);
    }
    text(topic.title, `Subtema ${id}.title`);
    optionalText(topic.summary, `Subtema ${id}.summary`);
    integer(topic.position, `Subtema ${id}.position`, 0);
  });

  const lessons = records(doc.lessons, "lessons");
  const lessonIds = new Set<string>();
  lessons.forEach((lesson, index) => {
    const id = addId(ids, lesson.id, `lessons[${index}].id`);
    lessonIds.add(id);
    const topicId = text(lesson.topicId, `Lección ${id}.topicId`);
    if (!topicIds.has(topicId) && !external) {
      fail(`La lección ${id} apunta a un subtema inexistente: ${topicId}.`);
    }
    optionalText(lesson.code, `Lección ${id}.code`);
    text(lesson.title, `Lección ${id}.title`);
    optionalText(lesson.eyebrow, `Lección ${id}.eyebrow`);
    optionalText(lesson.body, `Lección ${id}.body`);
    parseBlocks(lesson.content, `Lección ${id}.content`);
    integer(lesson.position, `Lección ${id}.position`, 0);
    sha256(lesson.hash, `Lección ${id}.hash`);
    parseReferenceIds(lesson.referenceIds, `Lección ${id}.referenceIds`, referenceIds);
  });

  const evaluations = records(doc.evaluations, "evaluations");
  const evaluationIds = new Set<string>();
  const evaluationsByLesson = new Map<string, EvaluationInfo>();
  evaluations.forEach((evaluation, index) => {
    const id = addId(ids, evaluation.id, `evaluations[${index}].id`);
    evaluationIds.add(id);
    const lessonId = text(evaluation.lessonId, `Evaluación ${id}.lessonId`);
    if (!lessonIds.has(lessonId) && !external) {
      fail(`La evaluación ${id} apunta a una lección inexistente: ${lessonId}.`);
    }
    if (evaluationsByLesson.has(lessonId)) {
      fail(`La lección ${lessonId} tiene más de una evaluación.`);
    }
    text(evaluation.title, `Evaluación ${id}.title`);
    optionalText(evaluation.description, `Evaluación ${id}.description`);
    integer(evaluation.position, `Evaluación ${id}.position`, 0);
    const questionIds = textList(evaluation.questionIds, `Evaluación ${id}.questionIds`);
    if (questionIds.length === 0) fail(`Evaluación ${id}: necesita al menos una pregunta.`);
    unique(questionIds, `Evaluación ${id}.questionIds`);
    const exerciseIds = textList(evaluation.exerciseIds, `Evaluación ${id}.exerciseIds`);
    unique(exerciseIds, `Evaluación ${id}.exerciseIds`);
    parseReferenceIds(evaluation.referenceIds, `Evaluación ${id}.referenceIds`, referenceIds);
    evaluationsByLesson.set(lessonId, { id, lessonId, questionIds, exerciseIds, raw: evaluation });
  });

  const questions = records(doc.questions, "questions");
  const questionsByEvaluation = new Map<string, Record<string, unknown>[]>();
  questions.forEach((question, index) => {
    const id = addId(ids, question.id, `questions[${index}].id`);
    const evaluationId = text(question.evaluationId, `Pregunta ${id}.evaluationId`);
    if (!evaluationIds.has(evaluationId)) {
      fail(`La pregunta ${id} apunta a una evaluación inexistente: ${evaluationId}.`);
    }
    validateQuestion(question, `Pregunta ${id}`);
    parseReferenceIds(question.referenceIds, `Pregunta ${id}.referenceIds`, referenceIds);
    const bucket = questionsByEvaluation.get(evaluationId) ?? [];
    bucket.push(question);
    questionsByEvaluation.set(evaluationId, bucket);
  });

  const exercises = records(doc.exercises, "exercises");
  const exerciseIds = new Set<string>();
  exercises.forEach((exercise, index) => {
    const id = addId(ids, exercise.id, `exercises[${index}].id`);
    exerciseIds.add(id);
    const lessonId = text(exercise.lessonId, `Ejercicio ${id}.lessonId`);
    if (!lessonIds.has(lessonId) && !external) {
      fail(`El ejercicio ${id} apunta a una lección inexistente: ${lessonId}.`);
    }
    parseExercise(exercise, `Ejercicio ${id}`);
    integer(exercise.position, `Ejercicio ${id}.position`, 0);
    parseReferenceIds(exercise.referenceIds, `Ejercicio ${id}.referenceIds`, referenceIds);
  });

  const examples = records(doc.examples, "examples");
  examples.forEach((example, index) => {
    const id = addId(ids, example.id, `examples[${index}].id`);
    const lessonId = text(example.lessonId, `Ejemplo ${id}.lessonId`);
    if (!lessonIds.has(lessonId) && !external) {
      fail(`El ejemplo ${id} apunta a una lección inexistente: ${lessonId}.`);
    }
    parseExample(example, `Ejemplo ${id}`);
    integer(example.position, `Ejemplo ${id}.position`, 0);
    parseReferenceIds(example.referenceIds, `Ejemplo ${id}.referenceIds`, referenceIds);
  });

  for (const [, info] of evaluationsByLesson) {
    const evaluationId = info.id;
    const published = questionsByEvaluation.get(evaluationId) ?? [];
    if (published.length !== info.questionIds.length) {
      fail(`Evaluación ${evaluationId}: questionIds no coincide con las preguntas publicadas.`);
    }
    for (const question of published) {
      if (!info.questionIds.includes(String(question.id))) {
        fail(`Evaluación ${evaluationId}: falta la pregunta ${String(question.id)} en questionIds.`);
      }
    }
    for (const exerciseId of info.exerciseIds) {
      if (!exerciseIds.has(exerciseId)) {
        fail(`Evaluación ${evaluationId}: el ejercicio ${exerciseId} no existe.`);
      }
      const exercise = exercises.find((item) => item.id === exerciseId);
      if (exercise && exercise.lessonId !== info.lessonId) {
        fail(`Evaluación ${evaluationId}: el ejercicio ${exerciseId} pertenece a otra lección.`);
      }
    }
  }

  for (const lesson of lessons) {
    const id = String(lesson.id);
    const { hash: declared, ...rest } = lesson;
    const evaluation = evaluationsByLesson.get(id) ?? null;
    const payload = {
      lesson: rest,
      evaluation: evaluation ? evaluation.raw : null,
      questions: evaluation ? questionsByEvaluation.get(evaluation.id) ?? [] : [],
      exercises: exercises.filter((item) => item.lessonId === id),
      examples: examples.filter((item) => item.lessonId === id),
    };
    const actual = hashValue(payload);
    if (actual !== declared) {
      fail(`Lección ${id}: hash no coincide (declarado ${String(declared)}, calculado ${actual}).`);
    }
  }

  return lessonIds;
}

function parseCourse(
  doc: Record<string, unknown>,
  ids: Set<string>,
  referenceIds: Set<string>,
): ReleaseV3 {
  text(doc.courseId, "courseId");
  const course = record(doc.course, "course");
  text(course.title, "course.title");
  optionalText(course.description, "course.description");
  choice(course.visibility, COURSE_VISIBILITY, "course.visibility");
  parseBaseRef(doc.baseRef);

  parseResources(doc, ids, referenceIds, "course");

  verifyReleaseHash(doc);
  return doc as unknown as ReleaseV3;
}

function parseGroup(
  doc: Record<string, unknown>,
  ids: Set<string>,
  referenceIds: Set<string>,
): ReleaseV3 {
  text(doc.groupId, "groupId");
  const group = record(doc.group, "group");
  text(group.name, "group.name");
  choice(group.visibility, GROUP_VISIBILITY, "group.visibility");

  const courseRef = record(doc.courseRef, "courseRef");
  integer(courseRef.version, "courseRef.version", 1);
  sha256(courseRef.hash, "courseRef.hash");

  const groupLessonIds = parseResources(doc, ids, referenceIds, "group");

  const additions = records(doc.additions, "additions");
  const additionLessons = new Set<string>();
  additions.forEach((addition, index) => {
    const where = `additions[${index}]`;
    const lessonId = text(addition.lessonId, `${where}.lessonId`);
    if (groupLessonIds.has(lessonId)) {
      fail(
        `La adición de ${lessonId} no es válida: es una lección propia del grupo; sus bloques van en lesson.content.`,
      );
    }
    if (additionLessons.has(lessonId)) fail(`Adición duplicada para la lección ${lessonId}.`);
    additionLessons.add(lessonId);
    for (const field of ["exercises", "examples"]) {
      if (field in addition) {
        fail(`La adición de ${lessonId} no puede incluir ${field}; usa el arreglo superior.`);
      }
    }
    parseBlocks(addition.blocks, `${where}.blocks`);
  });

  verifyReleaseHash(doc);
  return doc as unknown as ReleaseV3;
}

function parseRelease(raw: unknown): ReleaseV3 {
  const doc = record(raw, "Release");
  if (doc.schemaVersion !== 3) {
    fail(`schemaVersion incompatible: se espera el entero 3 y llegó ${JSON.stringify(doc.schemaVersion)}.`);
  }
  const kind = choice(doc.kind, ["course", "group"] as const, "kind");
  text(doc.catalogId, "catalogId");
  text(doc.releaseId, "releaseId");
  integer(doc.version, "version", 1);
  iso(doc.publishedAt, "publishedAt");
  sha256(doc.hash, "hash");

  const ids = new Set<string>();
  const referenceIds = parseReferences(doc.references, ids);
  parseNotices(doc.notices, ids);

  if (kind === "course") return parseCourse(doc, ids, referenceIds);
  return parseGroup(doc, ids, referenceIds);
}

/** Valida un release v3 (curso o grupo). Nunca lanza: devuelve el motivo. */
export function validateRelease(raw: unknown): ValidationResult {
  try {
    return { ok: true, release: parseRelease(raw) };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}
