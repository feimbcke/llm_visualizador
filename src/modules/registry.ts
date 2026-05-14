export interface ModuleMeta {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  /** What the visualization side will show once built. */
  vizDescription: string;
  /** Bullet list of what the visualization will include. */
  vizFeatures: string[];
  /** Default prompt suggestion for the chat in this module. */
  promptHint?: string;
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
  },
  {
    id: 'tools',
    number: 6,
    title: 'Herramientas y búsqueda web',
    subtitle: 'Por qué los modelos solos no saben la fecha de hoy',
    vizDescription:
      'La misma pregunta con y sin Google Search activado (grounding nativo de Gemini). Comparación lado a lado, con las fuentes citadas cuando hay búsqueda.',
    vizFeatures: [
      'Toggle: con / sin búsqueda web',
      'Respuestas comparadas en paralelo',
      'Fuentes y citas devueltas por Gemini',
    ],
    promptHint: '¿Qué actualizaciones hay esta semana sobre guías clínicas de hipertensión?',
  },
  {
    id: 'bias',
    number: 7,
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
    number: 8,
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
