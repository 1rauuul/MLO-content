"use client";

import { ResultDialog } from "@/app/(panel)/result-dialog";
import type { ExerciseType } from "@/lib/content/model";
import { EXAMPLE_SAMPLES, EXERCISE_SAMPLES } from "@/lib/content/samples";

import { Marker } from "./fields";
import { ExamplePreview, ExercisePreview } from "./preview";

const TYPE_LABEL: Record<ExerciseType, string> = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
};

const ACTIVITY_HINT: Record<ExerciseType, string> = {
  order: "Secuencia correcta: los elementos que el alumno debe reordenar.",
  fill: "Oraciones con {{palabras}} entre llaves y Palabras extra: el banco que elige el alumno.",
  match: "Pares: la columna izquierda y la derecha de cada relación.",
  crossword:
    "Cuadrícula y entradas: cada entrada es palabra + pista + fila/columna/dirección.",
};

function LegendItem({ marker, children }: { marker: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Marker>{marker}</Marker>
      <span>{children}</span>
    </li>
  );
}

export function SampleDialog({
  kind,
  type,
  open,
  dirty,
  onClose,
  onUse,
}: {
  kind: "exercise" | "example";
  type: ExerciseType;
  open: boolean;
  dirty: boolean;
  onClose: () => void;
  onUse: () => void;
}) {
  const exercise = EXERCISE_SAMPLES[type];
  const example = EXAMPLE_SAMPLES[type];

  return (
    <ResultDialog
      open={open}
      wide
      title={`Muestra · ${TYPE_LABEL[type]}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              onUse();
              onClose();
            }}
            className="btn btn-primary btn-sm"
          >
            {dirty ? "Reemplazar con la muestra" : "Usar esta muestra"}
          </button>
        </>
      }
    >
      <p className="text-xs">
        Actividad de muestra lista para publicar. Los números indican qué campo del
        formulario llena cada parte.
      </p>

      <div className="mt-3 max-h-[55vh] overflow-y-auto pr-1">
        {kind === "exercise" ? (
          <ExercisePreview
            type={type}
            prompt={exercise.prompt}
            instructions={exercise.instructions}
            correctOrder={exercise.correctOrder}
            config={exercise.config}
            explanation={exercise.explanation}
            example={null}
            markers={{ prompt: "①", instructions: "②", activity: "③", explanation: "④" }}
          />
        ) : (
          <ExamplePreview
            type={type}
            title={example.title}
            prompt={example.prompt}
            correctOrder={example.correctOrder}
            config={example.config}
            steps={example.steps}
            hints={example.hints}
            explanation={example.explanation}
            markers={{
              title: "①",
              prompt: "②",
              activity: "③",
              steps: "④",
              hints: "⑤",
              explanation: "⑥",
            }}
          />
        )}
      </div>

      <ul className="mt-4 space-y-1 text-xs">
        {kind === "exercise" ? (
          <>
            <LegendItem marker="①">Enunciado: el texto principal que ve el alumno.</LegendItem>
            <LegendItem marker="②">Instrucciones: la ayuda que aparece bajo el enunciado.</LegendItem>
            <LegendItem marker="③">{ACTIVITY_HINT[type]}</LegendItem>
            <LegendItem marker="④">Explicación: el texto que aparece al terminar.</LegendItem>
          </>
        ) : (
          <>
            <LegendItem marker="①">Título: el nombre de la explicación guiada.</LegendItem>
            <LegendItem marker="②">Enunciado: la actividad que se explica.</LegendItem>
            <LegendItem marker="③">{ACTIVITY_HINT[type]}</LegendItem>
            <LegendItem marker="④">Pasos: qué se hace y por qué, en orden.</LegendItem>
            <LegendItem marker="⑤">Pistas: ayuda opcional antes de resolver.</LegendItem>
            <LegendItem marker="⑥">Explicación: el cierre que ve el alumno.</LegendItem>
          </>
        )}
      </ul>
    </ResultDialog>
  );
}
