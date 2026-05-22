import type { ComponentType } from 'react';
import { StreamingModule } from './streaming';
import { TemperatureModule } from './temperature';
import { HallucinationsModule } from './hallucinations';
import { SystemPromptModule } from './system-prompt';
import { InjectionModule } from './injection';

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
    id: 'streaming',
    number: 1,
    title: 'Streaming de tokens',
    subtitle: 'Cómo los modelos generan texto un token a la vez',
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
  // Módulo 6 ("Herramientas y búsqueda web") fue diseñado en torno al
  // grounding de Google Search nativo de Gemini. Tras el cambio a Groq queda
  // oculto hasta definir el reemplazo (function calling, compound-beta, etc.).
  {
    id: 'bias',
    number: 6,
    title: 'Sesgos en medicina',
    subtitle: 'Cómo el contexto del paciente afecta las recomendaciones',
    vizDescription:
      'Viñetas clínicas idénticas con variaciones de demografía (género, edad, etnia). El modelo procesa cada variante y mostramos las diferencias en una tabla.',
    vizFeatures: [
      'Viñetas clínicas predefinidas',
      'Variaciones demográficas controladas',
      'Tabla comparativa de recomendaciones',
    ],
    promptHint: 'Paciente con dolor torácico de 6 horas de evolución. ¿Qué estudios solicitas?',
  },
  {
    id: 'memory',
    number: 7,
    title: 'Memoria de corto plazo',
    subtitle: 'La ventana de contexto y por qué el modelo olvida',
    vizDescription:
      'Una conversación larga con un contador de tokens visible y una barra que llena la ventana de contexto. Demostración en vivo de cómo el modelo "olvida" cuando se trunca.',
    vizFeatures: [
      'Contador de tokens por mensaje',
      'Barra de ventana de contexto',
      'Truncamiento manual para demostrar el olvido',
    ],
    promptHint: 'Recuerda este número: 47829. Voy a referirme a él más adelante.',
  },
];

export function getModuleById(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getModuleByNumber(n: number): ModuleMeta | undefined {
  return MODULES.find((m) => m.number === n);
}
