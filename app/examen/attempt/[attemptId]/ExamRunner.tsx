"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCountdown, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardBody } from "@/components/ui";

/** Constantes duplicadas a propósito: `lib/config` lee env vars de servidor. */
const AUTOSAVE_MS = 700;
const HEARTBEAT_INTERVAL_MS = 25_000;

export type RunnerOption = { index: number; text: string };

export type RunnerQuestion = {
  id: string;
  type: "mc" | "text";
  prompt: string;
  points: number;
  options: RunnerOption[];
};

export type RunnerAnswer = {
  selectedOption: number | null;
  answerText: string | null;
};

type Props = {
  attemptId: string;
  examTitle: string;
  deadlineAt: string;
  serverNow: string;
  /** false = examen sin límite de tiempo: el deadline es el cierre del examen. */
  timeLimited: boolean;
  attemptNumber: number;
  maxAttempts: number;
  /** Contadores ya registrados por el servidor (sobreviven a recargas). */
  initialFocusLosses: number;
  initialWarnings: number;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, RunnerAnswer>;
  warnAfterSeconds: number;
  maxWarnings: number;
  isPreview: boolean;
};

type EventPayload = { type: string; meta?: Record<string, unknown> };

type PendingValue = {
  selectedOption?: number | null;
  answerText?: string | null;
};

export default function ExamRunner({
  attemptId,
  examTitle,
  deadlineAt,
  serverNow,
  timeLimited,
  attemptNumber,
  maxAttempts,
  initialFocusLosses,
  initialWarnings,
  questions,
  initialAnswers,
  warnAfterSeconds,
  maxWarnings,
  isPreview,
}: Props) {
  const router = useRouter();

  const deadlineMs = useMemo(() => new Date(deadlineAt).getTime(), [deadlineAt]);
  const remainingAtRender = useMemo(
    () => Math.max(0, deadlineMs - new Date(serverNow).getTime()),
    [deadlineMs, serverNow],
  );

  const [remaining, setRemaining] = useState(remainingAtRender);
  const [answers, setAnswers] =
    useState<Record<string, RunnerAnswer>>(initialAnswers);
  const [warnings, setWarnings] = useState(initialWarnings);
  const [focusLosses, setFocusLosses] = useState(initialFocusLosses);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);

  const clockOffsetRef = useRef(0);
  const submittedRef = useRef(false);
  const remainingRef = useRef(remainingAtRender);
  const pendingRef = useRef<Map<string, PendingValue>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* --------------------------- guardado automático --------------------------- */

  const sendSave = useCallback(
    async (questionId: string, value: PendingValue) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/attempts/${attemptId}/answers`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId, ...value }),
        });

        if (res.status === 409) {
          // El examen se cerró (tiempo agotado) en el servidor.
          submittedRef.current = true;
          setLocked(true);
          router.replace(`/resultado/${attemptId}`);
          return;
        }
        if (!res.ok) throw new Error("save failed");

        setSaveState("saved");
        setSaveError(null);
        setLastSavedAt(new Date());
      } catch {
        setSaveState("error");
        setSaveError(
          "No se pudieron guardar tus respuestas. Revisá la conexión: lo escrito queda en esta pestaña y se reintenta al modificar de nuevo.",
        );
      }
    },
    [attemptId, router],
  );

  const flushQuestion = useCallback(
    async (questionId: string) => {
      const value = pendingRef.current.get(questionId);
      if (!value) return;
      pendingRef.current.delete(questionId);

      const timer = timersRef.current.get(questionId);
      if (timer) clearTimeout(timer);
      timersRef.current.delete(questionId);

      await sendSave(questionId, value);
    },
    [sendSave],
  );

  const flushAll = useCallback(async () => {
    const ids = [...pendingRef.current.keys()];
    await Promise.allSettled(ids.map((id) => flushQuestion(id)));
  }, [flushQuestion]);

  const queueSave = useCallback(
    (questionId: string, value: PendingValue) => {
      pendingRef.current.set(questionId, value);
      const existing = timersRef.current.get(questionId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        questionId,
        setTimeout(() => {
          void flushQuestion(questionId);
        }, AUTOSAVE_MS),
      );
    },
    [flushQuestion],
  );

  /* ------------------------------- eventos ---------------------------------- */

  const sendEvents = useCallback(
    (list: EventPayload[]) => {
      if (list.length === 0) return;
      const url = `/api/attempts/${attemptId}/events`;
      const body = JSON.stringify({ events: list });

      // sendBeacon sobrevive al cierre de la pestaña; fetch con keepalive no
      // siempre. Se usa según el estado de visibilidad.
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function" &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        try {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
          return;
        } catch {
          /* cae al fetch */
        }
      }

      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    },
    [attemptId],
  );

  /* ------------------------------- envío ------------------------------------ */

  const doSubmit = useCallback(
    async () => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setLocked(true);
      setSubmitting(true);

      try {
        await flushAll();
      } catch {
        /* seguimos: el servidor ya tiene lo autoguardado */
      }

      try {
        await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      } catch {
        /* la expiración perezosa del servidor cierra el intento igual */
      }

      router.replace(`/resultado/${attemptId}`);
    },
    [attemptId, flushAll, router],
  );

  const requestSubmit = useCallback(() => {
    if (submittedRef.current) return;
    const pending = pendingRef.current.size;
    const message =
      (isPreview ? "¿Finalizar la vista previa?" : "¿Enviar el examen?") +
      "\n\nDespués de enviarlo no vas a poder modificar tus respuestas." +
      (pending > 0 ? "\n\nHay respuestas guardándose: se envían antes de cerrar." : "");
    if (!window.confirm(message)) return;
    void doSubmit();
  }, [doSubmit, isPreview]);

  /* ------------------------------ reloj ------------------------------------- */

  useEffect(() => {
    clockOffsetRef.current = new Date(serverNow).getTime() - Date.now();
    remainingRef.current = remainingAtRender;
  }, [serverNow, remainingAtRender]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        deadlineMs - (Date.now() + clockOffsetRef.current),
      );
      remainingRef.current = left;
      setRemaining(left);

      if (left <= 0 && !submittedRef.current) {
        void doSubmit();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs, doSubmit]);

  /* ------------------------- foco / visibilidad ----------------------------- */

  useEffect(() => {
    // Misma regla que el servidor (lib/exam/focus.ts): una salida empieza con la
    // primera pérdida (pestaña oculta o ventana sin foco) y termina al volver.
    let awaySince: number | null = null;

    const markAway = () => {
      if (awaySince != null) return;
      awaySince = Date.now();
      setFocusLosses((previous) => previous + 1);
    };

    const markBack = (): number => {
      if (awaySince == null) return 0;
      const durationMs = Date.now() - awaySince;
      awaySince = null;
      if (durationMs >= warnAfterSeconds * 1000) {
        setWarnings((previous) => previous + 1);
      }
      return durationMs;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markAway();
        sendEvents([{ type: "hidden" }]);
        void flushAll();
        return;
      }
      const durationMs = markBack();
      sendEvents([{ type: "visible", meta: { durationMs } }]);
    };

    const onBlur = () => {
      markAway();
      sendEvents([{ type: "blur" }]);
    };
    const onFocus = () => {
      const durationMs = markBack();
      sendEvents([{ type: "focus", meta: { durationMs } }]);
    };

    const onPageHide = () => {
      sendEvents([{ type: "pagehide" }]);
      void flushAll();
    };

    const onCopy = () => sendEvents([{ type: "copy" }]);
    const onPaste = () => sendEvents([{ type: "paste" }]);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("beforeunload", onBeforeUnload);

    const isVisible = () =>
      document.visibilityState === "visible" && document.hasFocus();

    // Marca de presencia inicial: al volver a entrar se cierra la salida que
    // haya quedado abierta (p. ej. por cerrar la pestaña).
    if (isVisible()) {
      sendEvents([
        { type: "focus" },
        { type: "heartbeat", meta: { initial: true, visible: true } },
      ]);
    } else {
      markAway();
      sendEvents([
        { type: "blur" },
        { type: "heartbeat", meta: { initial: true, visible: false } },
      ]);
    }

    const heartbeat = setInterval(() => {
      sendEvents([
        {
          type: "heartbeat",
          meta: {
            remainingMs: Math.round(remainingRef.current),
            visible: isVisible(),
          },
        },
      ]);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(heartbeat);
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [sendEvents, flushAll, warnAfterSeconds]);

  /* ------------------------------- helpers ---------------------------------- */

  const selectOption = (questionId: string, optionIndex: number) => {
    if (locked) return;
    setAnswers((previous) => ({
      ...previous,
      [questionId]: { selectedOption: optionIndex, answerText: null },
    }));
    queueSave(questionId, { selectedOption: optionIndex });
  };

  const writeText = (questionId: string, value: string) => {
    if (locked) return;
    setAnswers((previous) => ({
      ...previous,
      [questionId]: { selectedOption: null, answerText: value },
    }));
    queueSave(questionId, { answerText: value });
  };

  const answeredCount = questions.filter((question) => {
    const answer = answers[question.id];
    if (!answer) return false;
    if (question.type === "mc") return answer.selectedOption != null;
    return (answer.answerText ?? "").trim().length > 0;
  }).length;

  const totalPoints = questions.reduce((acc, q) => acc + q.points, 0);

  const timeTone =
    remaining <= 60_000
      ? "text-red-600"
      : remaining <= 5 * 60_000
        ? "text-amber-600"
        : "text-slate-900";

  const overWarnLimit = maxWarnings > 0 && warnings >= maxWarnings;

  return (
    <div className="min-h-dvh">
      {/* Barra superior fija */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {examTitle}
              </p>
              {isPreview ? <Badge tone="amber">Vista previa</Badge> : null}
            </div>
            <p className="text-xs text-slate-500">
              {answeredCount} de {questions.length} respondidas · {totalPoints} pts
              {!isPreview && maxAttempts > 1
                ? ` · Intento ${attemptNumber} de ${maxAttempts}`
                : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {timeLimited ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Tiempo restante
                </p>
                <p
                  className={cn(
                    "font-mono text-xl font-bold tabular-nums",
                    timeTone,
                    remaining <= 60_000 && "animate-pulse",
                  )}
                  aria-live="off"
                >
                  {formatCountdown(remaining)}
                </p>
              </div>
            ) : (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Sin límite de tiempo
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  Cierra {formatDateTime(deadlineAt)}
                </p>
              </div>
            )}
            <Button
              variant={overWarnLimit ? "danger" : "primary"}
              onClick={requestSubmit}
              disabled={submitting || locked}
            >
              {submitting ? "Enviando…" : isPreview ? "Finalizar vista previa" : "Enviar"}
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {saveState === "saving" ? <span>Guardando…</span> : null}
            {saveState === "saved" && lastSavedAt ? (
              <span className="text-emerald-600">
                Guardado{" "}
                {lastSavedAt.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            ) : null}
            {saveState === "error" ? (
              <span className="font-medium text-red-600">Sin guardar</span>
            ) : null}
            <span aria-hidden>·</span>
            <span
              className={cn(
                "inline-flex items-center gap-1",
                warnings > 0 && "font-medium text-amber-700",
              )}
            >
              Salidas de foco: {focusLosses}
            </span>
            {maxWarnings > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className={cn(overWarnLimit && "font-medium text-red-600")}>
                  Advertencias: {warnings} / {maxWarnings}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        {isPreview ? (
          <Alert tone="indigo" title="Vista previa docente">
            Este intento no consume rendiciones ni aparece en los resultados de alumnos.
          </Alert>
        ) : null}
        {saveError ? <Alert tone="red">{saveError}</Alert> : null}

        {remaining <= 5 * 60_000 && remaining > 0 ? (
          <Alert tone="amber" title="Quedan menos de 5 minutos">
            Revisá que hayas enviado el examen antes de que llegue a cero.
          </Alert>
        ) : null}

        {focusLosses > 0 ? (
          <Alert
            tone={overWarnLimit ? "red" : "amber"}
            title={
              overWarnLimit
                ? "Superaste el máximo de salidas de foco"
                : "Se registró una salida de foco"
            }
          >
            {overWarnLimit
              ? `Registramos ${focusLosses} salidas de la pestaña (${warnings} largas). Queda en el historial del examen y el docente puede verlo.`
              : `Cada cambio de pestaña o pérdida de foco queda registrado con fecha, hora y duración. Llevás ${focusLosses} ${focusLosses === 1 ? "salida" : "salidas"}${maxWarnings > 0 ? ` y ${warnings} de ${maxWarnings} advertencias` : ""}.`}
          </Alert>
        ) : null}

        <ol className="space-y-4">
          {questions.map((question, index) => {
            const answer = answers[question.id];
            return (
              <li key={question.id}>
                <Card>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="indigo">Pregunta {index + 1}</Badge>
                        {question.type === "text" ? (
                          <Badge tone="sky">A desarrollar</Badge>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        {question.points} {question.points === 1 ? "punto" : "puntos"}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-900">
                      {question.prompt}
                    </p>

                    {question.type === "mc" ? (
                      <div className="space-y-2" role="radiogroup">
                        {question.options.map((option) => {
                          const checked = answer?.selectedOption === option.index;
                          return (
                            <label
                              key={option.index}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                                checked
                                  ? "border-indigo-400 bg-indigo-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                                locked && "cursor-not-allowed opacity-70",
                              )}
                            >
                              <input
                                type="radio"
                                name={`q-${question.id}`}
                                className="mt-0.5 size-4 shrink-0 accent-indigo-600"
                                checked={checked}
                                disabled={locked}
                                onChange={() =>
                                  selectOption(question.id, option.index)
                                }
                              />
                              <span className="leading-relaxed">{option.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        className="min-h-40 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed shadow-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-600/30 disabled:bg-slate-100"
                        placeholder="Escribí tu respuesta acá…"
                        value={answer?.answerText ?? ""}
                        disabled={locked}
                        onChange={(event) =>
                          writeText(question.id, event.target.value)
                        }
                      />
                    )}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col items-center gap-3 py-4">
          <Button
            size="lg"
            variant={overWarnLimit ? "danger" : "success"}
            onClick={requestSubmit}
            disabled={submitting || locked}
            className="w-full sm:w-auto"
          >
            {submitting
              ? "Enviando…"
              : isPreview
                ? "Finalizar vista previa"
                : "Enviar examen"}
          </Button>
          <p className="text-center text-xs text-slate-500">
            {isPreview
              ? "Las respuestas se guardan durante la prueba. Al finalizar, volverás al panel docente."
              : timeLimited
                ? "Tus respuestas se guardan solas. Si se cierra la pestaña, volvé a entrar desde «Mis exámenes»: el tiempo sigue corriendo."
                : "Tus respuestas se guardan solas. Si se cierra la pestaña, volvé a entrar desde «Mis exámenes» antes del cierre del examen."}
          </p>
        </div>
      </main>
    </div>
  );
}
