import { useRef, useState } from 'react';
import { streamText } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

const MODEL = 'gpt-4.1-nano';

const GOAL =
  'Paciente: mujer de 79 años con fibrilación auricular no valvular, hipertensión y diabetes tipo 2. ¿Debo anticoagularla y con qué dosis?';

interface Step {
  thought: string;
  toolName: string;
  toolArgs: string;
  observation: string;
}

// Deterministic trace: the tool outputs are staged on the frontend. The path is
// conditional — the agent only checks renal function because it first decided to
// anticoagulate — which is the point: it plans across steps toward the goal.
const STEPS: Step[] = [
  {
    thought: 'Para decidir si anticoagular en fibrilación auricular, primero estimo el riesgo embólico.',
    toolName: 'calcular_chads_vasc',
    toolArgs: 'edad=79, sexo=F, HTA=sí, DM=sí, ICC=no, AVE=no, vascular=no',
    observation: 'CHA₂DS₂-VASc = 5 → riesgo alto (≥2): se beneficia de anticoagulación.',
  },
  {
    thought: 'Riesgo alto → hay indicación. Para elegir y dosificar el fármaco necesito la función renal.',
    toolName: 'obtener_ultimo_examen',
    toolArgs: 'examen="creatinina"',
    observation: 'Creatinina 1.3 mg/dL (hoy 07:30).',
  },
  {
    thought: 'Calculo el clearance para saber si puedo usar un anticoagulante directo (DOAC) y a qué dosis.',
    toolName: 'calcular_clearance',
    toolArgs: 'edad=79, peso=70, creatinina=1.3, sexo=F',
    observation: '≈ 39 mL/min (deterioro moderado): permite un DOAC.',
  },
  {
    thought: 'Verifico los criterios de reducción de dosis de apixabán (edad ≥80, peso ≤60 kg, creatinina ≥1.5).',
    toolName: 'consultar_criterios_apixaban',
    toolArgs: 'edad=79, peso=70, creatinina=1.3',
    observation: '0 de 3 criterios → corresponde dosis estándar (5 mg c/12 h).',
  },
];

const FINAL_PROMPT =
  'Caso: mujer de 79 años con fibrilación auricular no valvular, hipertensión y diabetes tipo 2. ' +
  'Datos que recopiló el agente con sus herramientas: CHA₂DS₂-VASc = 5 (riesgo alto); ' +
  'creatinina 1.3 mg/dL; clearance de creatinina ≈ 39 mL/min; no cumple criterios de reducción de ' +
  'dosis de apixabán (0 de 3). Redacta en 2 o 3 frases, en español y con tono clínico profesional, ' +
  'la recomendación de anticoagulación y la dosis.';

const FALLBACK_REC =
  'Se recomienda iniciar anticoagulación oral con apixabán 5 mg cada 12 horas (dosis estándar, ya que ' +
  'no cumple criterios de reducción). Un anticoagulante directo es preferible a warfarina, y el clearance ' +
  'de ~39 mL/min lo permite. El CHA₂DS₂-VASc de 5 indica alto riesgo embólico que justifica anticoagular.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = 'idle' | 'running' | 'finalizing' | 'done';

export function AgenticModule(_props: ModuleProps) {
  const { authed } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeStep, setActiveStep] = useState(-1);
  const [shownSteps, setShownSteps] = useState(0);
  const [recommendation, setRecommendation] = useState('');
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!authed || phase === 'running' || phase === 'finalizing') return;
    cancelledRef.current = false;
    setPhase('running');
    setActiveStep(-1);
    setShownSteps(0);
    setRecommendation('');

    for (let i = 0; i < STEPS.length; i++) {
      if (cancelledRef.current) return;
      setActiveStep(i); // show thought + tool call, observation "ejecutando…"
      await sleep(950);
      if (cancelledRef.current) return;
      setShownSteps(i + 1); // reveal observation
      setActiveStep(-1);
      await sleep(550);
    }

    if (cancelledRef.current) return;
    setPhase('finalizing');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let acc = '';
      for await (const delta of streamText({
        model: MODEL,
        systemInstruction: 'Eres un asistente clínico. Responde en español, breve y profesional.',
        contents: [{ role: 'user', parts: [{ text: FINAL_PROMPT }] }],
        generationConfig: { temperature: 0.3 },
        signal: ctrl.signal,
      })) {
        if (cancelledRef.current) break;
        acc += delta;
        setRecommendation(acc);
      }
      if (!acc.trim()) setRecommendation(FALLBACK_REC);
    } catch (err) {
      // Bulletproof on stage: any failure falls back to the written recommendation.
      if ((err as Error).name !== 'AbortError') setRecommendation(FALLBACK_REC);
    } finally {
      abortRef.current = null;
    }
    if (!cancelledRef.current) setPhase('done');
  }

  function stop() {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setPhase((p) => (p === 'idle' ? 'idle' : 'done'));
  }

  const busy = phase === 'running' || phase === 'finalizing';

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Agente clínico</div>
        <div className="text-xs text-muted">Le das un objetivo; él planifica y actúa</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="flex justify-end">
          <div className="max-w-[90%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
            {GOAL}
          </div>
        </div>

        {(phase === 'finalizing' || phase === 'done') && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">
              {recommendation || <span className="text-muted italic">razonando la recomendación…</span>}
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <p className="text-center text-sm text-muted py-4">
            Presiona "Ejecutar agente" y observa, en el panel de pasos, cómo descompone el problema.
          </p>
        )}
      </div>

      <div className="border-t border-border p-3 bg-white shrink-0">
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="w-full px-4 py-2.5 rounded-lg border border-border text-ink hover:bg-surface font-medium text-sm"
          >
            Detener
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void run()}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium text-sm"
          >
            {phase === 'done' ? 'Ejecutar de nuevo' : 'Ejecutar agente'}
          </button>
        )}
      </div>
    </div>
  );

  const VizPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Cómo lo resuelve el agente</div>
        <div className="text-xs text-muted">Pensar → usar herramienta → observar → seguir</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
          Un agente no responde de una sola vez: <strong>planifica, usa herramientas, observa el
          resultado y decide el siguiente paso</strong>, hasta cumplir el objetivo. Cada paso depende
          del anterior.
        </div>

        {phase === 'idle' && (
          <div className="text-center text-sm text-muted py-6">
            Aún no ha empezado. Ejecuta el agente para ver sus pasos.
          </div>
        )}

        {STEPS.map((s, i) => {
          const visible = i < shownSteps || i === activeStep;
          if (!visible) return null;
          const observed = i < shownSteps;
          return (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 shrink-0 rounded-full bg-brand-500 text-white text-xs font-semibold grid place-items-center">
                  {i + 1}
                </span>
                <span className="text-xs text-muted">Paso {i + 1}</span>
              </div>
              <div className="text-sm text-body">
                <span className="mr-1">🧠</span>
                {s.thought}
              </div>
              <div className="rounded-md bg-surface border border-border p-2 font-mono text-xs">
                <div className="text-brand-700">🔧 {s.toolName}({s.toolArgs})</div>
                {observed ? (
                  <div className="text-ink mt-0.5">👁 {s.observation}</div>
                ) : (
                  <div className="text-muted mt-0.5 italic">ejecutando…</div>
                )}
              </div>
            </div>
          );
        })}

        {phase === 'done' && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 text-sm text-ink">
            <span className="mr-1">✅</span>
            <strong>Objetivo cumplido</strong> en {STEPS.length} pasos. La recomendación final está en
            el chat.
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        Las herramientas están simuladas en esta página, pero el patrón es real: el agente encadena
        pasos y decide el siguiente según lo que observa.
      </div>
    </div>
  );

  return (
    <>
      <div className="block">{ChatPane}</div>
      <div className="block">{VizPane}</div>
    </>
  );
}
