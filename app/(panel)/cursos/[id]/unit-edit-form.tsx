"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { RequiredMark } from "@/app/(panel)/required-mark";
import { updateUnit, type ActionResult } from "@/lib/actions/content";

export function UnitEditForm({
  courseId,
  unit,
}: {
  courseId: string;
  unit: { id: string; title: string; description: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateUnit, {});
  const [title, setTitle] = useState(unit.title);
  const [description, setDescription] = useState(unit.description);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const initial = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const versionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: unit.title, description: unit.description });

  const save = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current) return;
    const latest = latestRef.current;
    if (latest.title.trim().length < 3) return;

    const version = versionRef.current;
    savingRef.current = true;
    setSaving(true);
    setAutoError(null);

    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("unitId", unit.id);
    formData.set("title", latest.title);
    formData.set("description", latest.description);

    const result = await updateUnit({}, formData);
    savingRef.current = false;
    setSaving(false);
    if (result.error) {
      setAutoError(result.error);
      return;
    }

    if (version !== versionRef.current) {
      // Hubo cambios mientras guardaba: dejar el estado sucio y reintentar.
      setSaved(false);
      setRetry((current) => current + 1);
      return;
    }

    dirtyRef.current = false;
    setDirty(false);
    setSaved(true);
  }, [courseId, unit.id]);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, description, save]);

  useEffect(() => {
    if (retry === 0) return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [retry, save]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) void save();
    };
  }, [save]);

  const changeTitle = (value: string) => {
    setTitle(value);
    latestRef.current = { ...latestRef.current, title: value };
    versionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
    setAutoError(null);
  };

  const changeDescription = (value: string) => {
    setDescription(value);
    latestRef.current = { ...latestRef.current, description: value };
    versionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
    setAutoError(null);
  };

  const status = saving
    ? "Guardando…"
    : autoError
      ? autoError
      : dirty
        ? "Cambios sin guardar"
        : saved
          ? "Guardado"
          : null;

  return (
    <form
      action={action}
      className="grid gap-3"
      onSubmit={() => {
        dirtyRef.current = false;
        setDirty(false);
        setAutoError(null);
      }}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unit.id} />
      <label className="field-label">
        <span>Título de la unidad <RequiredMark /></span>
        <input
          name="title"
          value={title}
          onChange={(event) => changeTitle(event.target.value)}
          required
          aria-invalid={Boolean(state.error || autoError)}
          aria-describedby={state.error ? "unit-edit-error" : undefined}
          className="field"
        />
      </label>
      <label className="field-label">
        Descripción
        <textarea
          name="description"
          value={description}
          onChange={(event) => changeDescription(event.target.value)}
          rows={2}
          className="field"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || saving} className="btn btn-primary btn-sm">
          {pending || saving ? "Guardando…" : "Guardar unidad"}
        </button>
        <span
          className={`text-xs ${
            autoError ? "text-danger" : saved ? "text-positive" : "text-ink-faint"
          }`}
          role="status"
        >
          {status}
        </span>
        {state.error && (
          <p id="unit-edit-error" className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="form-ok" role="status">
            Unidad guardada.
          </p>
        )}
      </div>
      <p className="text-xs text-ink-faint">* Campo obligatorio</p>
    </form>
  );
}
