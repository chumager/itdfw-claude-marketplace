// The shapes of bin/cartera.sh's files, as the cartera band (hooks/cartera.tsx) reads them. The keys and the state
// words are Spanish on purpose: they are the contract of the script (see its header).

/** Who has the ball: en_curso the session, pendiente the person, parqueada nobody until a condition; old files may hold pendiente with free text, read as parqueada. */
export type EstadoTarea = 'en_curso' | 'pendiente' | 'parqueada' | 'terminado'

/** One task inside a block; espera is "go", "texto" (a question for the person) or free text (what it waits for). */
export type Tarea = {
  tarea: string
  estado: EstadoTarea
  at?: number
  espera?: string
  pregunta?: string
  nota?: string
  /** Set by the coordinator: how long a parked task may wait before it turns red (alta 1 hour, media 1 day, baja 2 days; none, never). */
  prioridad?: 'alta' | 'media' | 'baja'
  /** What the task needs the person to know to decide right there (multi-line). */
  desc?: string
}

/** A block of work of one session; its state is derived from its tasks, never stored. */
export type Bloque = {
  bloque: string
  dueno: string
  at?: number
  archivado?: boolean
  /** What the block is, why it matters and what it needs to move (multi-line). */
  desc?: string
  tareas: Tarea[]
}

export type Rutina = { rutina: string; dueno: string; at?: number }

declare module 'claude-code' {
  interface PluginState {
    'itdfw-sessions': {
      carteraBloques: Shaped<Bloque[]>
      carteraRutinas: Shaped<Rutina[]>
      carteraError: Shaped<string>
      carteraIsHidden: Shaped<boolean>
      carteraOpened: Shaped<string[]>
      carteraGone: Shaped<string[]>
      carteraAnswering: Shaped<string>
      carteraSnapshot: Shaped<Record<string, string>>
      carteraDecisionsSeen: Shaped<number>
    }
  }
}
