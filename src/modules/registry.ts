import type { ComponentType } from 'react';
import { SeahorseModule } from './seahorse';
import { StreamingModule } from './streaming';
import { TemperatureModule } from './temperature';
import { HallucinationsModule } from './hallucinations';
import { SystemPromptModule } from './system-prompt';
import { InjectionModule } from './injection';
import { BiasModule } from './bias';
import { ToolsModule } from './tools';
import { AgenticModule } from './agentic';

export interface ModuleProps {
  tab: 'chat' | 'viz';
  module: ModuleMeta;
  /**
   * Call when the module's primary action runs (send, generate, …). On mobile
   * this switches to the visualization tab; on desktop both panes are visible
   * so it is a no-op.
   */
  onMainAction?: () => void;
}

export interface ModuleMeta {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  /** Model this module uses, shown in the banner. */
  model: string;
  /** What the visualization side will show once built (for placeholder modules). */
  vizDescription: string;
  /** Bullet list of what the visualization will include (for placeholder modules). */
  vizFeatures: string[];
  /** Default prompt suggestion for the chat in this module. */
  promptHint?: string;
  /**
   * Mobile layout. 'tabs' (default) shows Chat/Visualización as switchable tabs;
   * 'stack' renders both panes stacked (chat above visualization) with no tabs.
   */
  mobileLayout?: 'tabs' | 'stack';
  /** Custom render for this module. If absent, the placeholder is used. */
  Component?: ComponentType<ModuleProps>;
}

export const MODULES: readonly ModuleMeta[] = [
  {
    id: 'seahorse',
    number: 0,
    title: 'El caballito de mar',
    subtitle: 'Los modelos no "piensan": generan un token a la vez',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Una sola pregunta predefinida, respondida en vivo: el modelo entra en un bucle de "autocorrección" mostrando emojis equivocados, porque genera token a token sin un plan global.',
    vizFeatures: [
      'Pregunta predefinida (un clic)',
      'Respuesta en streaming, con emojis',
      'Por qué parece pensar sin pensar',
    ],
    mobileLayout: 'stack',
    Component: SeahorseModule,
  },
  {
    id: 'streaming',
    number: 1,
    title: 'Streaming de tokens',
    subtitle: 'Cómo los modelos generan texto un token a la vez',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Cada token aparecerá como un chip a medida que el modelo lo genera, con su índice, identificador y — cuando esté disponible — las alternativas que el modelo consideró.',
    vizFeatures: [
      'Token-por-token en vivo',
      'Velocidad de generación visible',
      'Alternativas top-K cuando el modelo las expone',
    ],
    promptHint: 'Explícame en una frase qué es un token en un LLM.',
    Component: StreamingModule,
  },
  {
    id: 'temperature',
    number: 2,
    title: 'Temperatura',
    subtitle: 'El parámetro que controla la creatividad y la consistencia',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Un control deslizante de 0.0 a 2.0 y un botón "generar 3 respuestas" para comparar lado a lado cómo cambia la salida con la misma pregunta.',
    vizFeatures: [
      'Slider de temperatura 0.0 – 2.0',
      'Generación múltiple comparativa',
      'Distribución visible de las respuestas',
    ],
    promptHint: 'Dame tres ideas para iniciar una consulta médica.',
    Component: TemperatureModule,
  },
  {
    id: 'hallucinations',
    number: 3,
    title: 'Alucinaciones',
    subtitle: 'Por qué los modelos inventan respuestas con confianza',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Ejemplos clásicos pre-herramientas: forzar al modelo a decir 2+2=5, o pedirle una cita bibliográfica de un paper que no existe. El modelo "completa" estadísticamente sin saber.',
    vizFeatures: [
      'Demostraciones guiadas en un clic',
      'Marcado de citas y datos inventados',
      'Comparación con la versión "con herramientas"',
    ],
    promptHint: 'Cítame un artículo de NEJM sobre el uso de SGLT2 en cirrosis descompensada.',
    mobileLayout: 'stack',
    Component: HallucinationsModule,
  },
  {
    id: 'system-prompt',
    number: 4,
    title: 'Prompt de sistema',
    subtitle: 'Cómo cambiar el rol y el tono del modelo',
    model: 'gpt-5-nano',
    vizDescription:
      'Editor visible del prompt de sistema con presets ("Médico cauteloso", "Estudiante de medicina", "Asistente sin filtros"). Misma pregunta del usuario, distintas respuestas.',
    vizFeatures: [
      'Editor del system prompt',
      'Presets para comparar rápidamente',
      'Vista comparativa de respuestas',
    ],
    promptHint: '¿Debería iniciar anticoagulación en este paciente con fibrilación auricular?',
    Component: SystemPromptModule,
  },
  {
    id: 'injection',
    number: 5,
    title: 'Inyección de prompts',
    subtitle: 'Cuando el contenido del usuario sobrescribe las instrucciones del sistema',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Un "documento clínico" simulado que contiene instrucciones ocultas. El usuario pide un resumen y el modelo termina siguiendo la instrucción inyectada en lugar del prompt de sistema.',
    vizFeatures: [
      'Documento clínico con texto inyectado resaltado',
      'Demostración del fallo en vivo',
      'Estrategias básicas de mitigación',
    ],
    promptHint: 'Resúmeme la siguiente nota clínica.',
    mobileLayout: 'stack',
    Component: InjectionModule,
  },
  {
    id: 'bias',
    number: 6,
    title: 'Sesgos en medicina',
    subtitle: 'Cómo el contexto del paciente afecta las recomendaciones',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Viñetas clínicas idénticas con variaciones de demografía (género, edad, etnia). El modelo procesa cada variante y mostramos las diferencias en una tabla.',
    vizFeatures: [
      'Viñetas clínicas predefinidas',
      'Variaciones demográficas controladas',
      'Tabla comparativa de recomendaciones',
    ],
    promptHint: 'Paciente con dolor torácico de 6 horas de evolución. ¿Qué estudios solicitas?',
    Component: BiasModule,
  },
  {
    id: 'tools',
    number: 7,
    title: 'Herramientas',
    subtitle: 'Cómo las herramientas superan los límites del modelo',
    model: 'gpt-4.1-nano',
    vizDescription:
      'La misma pregunta respondida de dos formas: el modelo solo (que se equivoca al calcular o no conoce datos actuales) y el modelo con una herramienta (calculadora o consulta a la ficha) que le da el resultado exacto.',
    vizFeatures: [
      'Cálculo médico exacto vs. estimación del modelo',
      'Consulta de datos en tiempo real (laboratorio)',
      'Comparación lado a lado',
    ],
    promptHint: 'Calcula el clearance de creatinina de un hombre de 72 años, 80 kg, creatinina 1.4.',
    Component: ToolsModule,
  },
  {
    id: 'agentic',
    number: 8,
    title: 'Agéntica',
    subtitle: 'Modelos que planifican y actúan en varios pasos',
    model: 'gpt-4.1-nano',
    vizDescription:
      'Un agente combina varias herramientas y pasos para resolver una tarea: decide qué hacer, ejecuta, observa el resultado y continúa hasta lograr el objetivo.',
    vizFeatures: [
      'Encadenamiento de herramientas',
      'Planificación en varios pasos',
      'Observación y corrección',
    ],
    mobileLayout: 'stack',
    Component: AgenticModule,
  },
];

export function getModuleById(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getModuleByNumber(n: number): ModuleMeta | undefined {
  return MODULES.find((m) => m.number === n);
}
