import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bloque, Rutina, Tarea } from '../types'

// cartera: the band above the prompt that merges every session's work board (bin/cartera.sh writes one JSON file per
// session) and lets the person answer from it: a GO, an answer to a question, the ✔ that archives a finished block.
// It also feeds the panel session, unseen by the person, what moved since its last turn and the new decisions of the
// coordinator. It is OFF by default in every session: `/cartera` (or `/cartera on|off`) turns it on or off in the
// session where it is typed, and the choice is kept in that session's state, across reloads. Off, it reads nothing
// and runs nothing. Folding the band (the engine's own shortcut) is not turning it off: folded, it keeps reading.
//
// The words of the band, of the files and of the messages are Spanish on purpose: they are the contract the sessions
// already read (see bin/cartera.sh).

// an en_curso task untouched for longer than this turns red: nobody has said anything, someone should look
const STALE_MS = 60 * 60 * 1000

/** What bin/cartera.sh panel answers; resolved when the band is turned on. */
type Config = { dir: string; decisiones: string; persona: string; send: string; cartera: string }
let cfg: Config | null = null
// true while the band is on in this session: every hook below passes through untouched otherwise
let active = false
// the 3-second poll, cancelled when the band is turned off
let tick: { cancel: () => void } | null = null

// the plugin and key go as literals: the validator reads every atom's source from the code
const bloques = atom({ plugin: 'itdfw-sessions', key: 'carteraBloques' } as const, [], { shape: 'bloques-3' })
const rutinas = atom({ plugin: 'itdfw-sessions', key: 'carteraRutinas' } as const, [], { shape: 'rutinas-1' })
const error = atom({ plugin: 'itdfw-sessions', key: 'carteraError' } as const, '', { shape: 'error-1' })
// whether the person turned the band on in this session (`/cartera`); off by default
const isOn = atom({ plugin: 'itdfw-sessions', key: 'carteraIsOn' } as const, false, { shape: 'on-1' })
// open nodes: "activos", "terminados", "s:<owner>", "b:<owner>/<block>", "t:<task id>", and "g:<owner>:<class>" for a
// state group flipped from its default (yours and running start open, parked starts closed); all collapsed at start
const opened = atom({ plugin: 'itdfw-sessions', key: 'carteraOpened' } as const, [], { shape: 'opened-4' })
// pending tasks the person already answered ("<owner>/<block>/<task>")
const gone = atom({ plugin: 'itdfw-sessions', key: 'carteraGone' } as const, [], { shape: 'gone-2' })
// the pending task whose answer field is open, "" when none
const answering = atom({ plugin: 'itdfw-sessions', key: 'carteraAnswering' } as const, '', { shape: 'answering-2' })
// "<owner>/<block>/<task>" → "<state>|<note>", and "<owner>/<block>" → "B|<derived state>", as the panel last saw them
const snapshot = atom({ plugin: 'itdfw-sessions', key: 'carteraSnapshot' } as const, {}, { shape: 'snapshot-2' })
// decision lines already delivered; -1 until the first look, which only takes the count
const decisionsSeen = atom({ plugin: 'itdfw-sessions', key: 'carteraDecisionsSeen' } as const, -1, { shape: 'decisions-1' })

const blockId = (b: Bloque) => `${b.dueno}/${b.bloque}`
const taskId = (b: Bloque, t: Tarea) => `${b.dueno}/${b.bloque}/${t.tarea}`
const isDone = (b: Bloque) => b.tareas.length > 0 && b.tareas.every(t => t.estado === 'terminado')
const waitsForMe = (t: Tarea) => t.estado === 'pendiente' && (t.espera === 'go' || t.espera === 'texto')

// who has the ball; a pendiente that does not wait for the person (old files) has no owner today, so it reads as parked
type Clase = 'tuya' | 'curso' | 'parqueada'
const claseOf = (t: Tarea): Clase => (t.estado === 'en_curso' ? 'curso' : waitsForMe(t) ? 'tuya' : 'parqueada')
// a parked task turns red only by the priority the coordinator gave it: without one, it was parked on purpose
const PARKED_MS: Record<string, number> = { alta: STALE_MS, media: 24 * STALE_MS, baja: 48 * STALE_MS }
const isStale = (t: Tarea, now: number) => {
  if (t.at === undefined) return false
  if (t.estado === 'en_curso') return now - t.at > STALE_MS
  const limit = claseOf(t) === 'parqueada' && t.prioridad ? PARKED_MS[t.prioridad] : undefined
  return limit !== undefined && now - t.at > limit
}

const ago = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 60) return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h${String(min % 60).padStart(2, '0')}`
  return `hace ${Math.floor(h / 24)}d`
}

// old flat format ([{tema, estado}]) read the same way the script migrates it, so a stray file never blanks the band
type Raw = { bloques?: Omit<Bloque, 'dueno'>[]; rutinas?: Omit<Rutina, 'dueno'>[] } | Record<string, unknown>[]
const normalize = (raw: Raw, dueno: string): { bloques: Bloque[]; rutinas: Rutina[] } => {
  if (Array.isArray(raw)) {
    const old = raw as { tema?: string; estado?: string; at?: number; espera?: string; pregunta?: string; nota?: string }[]
    return {
      bloques: old
        .filter(t => t && t.tema)
        .map(t => ({
          bloque: t.tema as string,
          dueno,
          at: t.at,
          archivado: t.estado === 'archivado' || undefined,
          tareas: [
            {
              tarea: t.tema as string,
              estado: t.estado === 'activo' ? 'en_curso' : t.estado === 'archivado' ? 'terminado' : (t.estado as Tarea['estado']),
              at: t.at,
              espera: t.espera,
              pregunta: t.pregunta,
              nota: t.nota,
            },
          ],
        })),
      rutinas: [],
    }
  }
  return {
    bloques: (raw.bloques ?? []).filter(b => b && b.bloque).map(b => ({ ...b, dueno, tareas: b.tareas ?? [] })),
    rutinas: (raw.rutinas ?? []).filter(r => r && r.rutina).map(r => ({ ...r, dueno })),
  }
}

/** Asks the plugin's own script where the board lives and whose name the band speaks for. */
const configure = async ($: EngineInterface): Promise<boolean> => {
  const bin = `${$.plugin.root}/bin`
  last = ''
  try {
    const panel = await $.process.run([`${bin}/cartera.sh`, 'panel'])
    const p = JSON.parse(String(panel.stdout)) as Omit<Config, 'send' | 'cartera'>
    cfg = { ...p, send: `${bin}/claude-session-msg.sh`, cartera: `${bin}/cartera.sh` }
    return true
  } catch {
    cfg = null
    return false
  }
}

let last = ''

const load = async ($: EngineInterface) => {
  if (!cfg) return
  const dir = cfg.dir
  let files: string[]
  try {
    files = (await $.fs.list(dir)).filter(f => f.kind === 'file' && f.name.endsWith('.json')).map(f => f.name).sort()
  } catch {
    if (last !== 'missing') {
      last = 'missing'
      await update($, error, () => `sin ${dir}`)
    }
    return
  }
  const parts: string[] = []
  const allB: Bloque[] = []
  const allR: Rutina[] = []
  const bad: string[] = []
  for (const name of files) {
    const dueno = name.slice(0, -'.json'.length)
    try {
      const text = await $.fs.read(`${dir}/${name}`)
      parts.push(name, text)
      const { bloques: b, rutinas: r } = normalize(JSON.parse(text) as Raw, dueno)
      allB.push(...b)
      allR.push(...r)
    } catch {
      bad.push(name)
    }
  }
  const key = parts.join('\u0000') + bad.join(',')
  if (key === last) return
  last = key
  await update($, bloques, () => allB)
  await update($, rutinas, () => allR)
  await update($, error, () => (bad.length ? `no pude leer: ${bad.join(', ')}` : ''))
}

// ── GO, answers and archive: messages to the owner session in the person's name, or the script ──
const reply = async ($: EngineInterface, b: Bloque, t: Tarea, text: string, what: string) => {
  if (!cfg) return
  try {
    // the sender is `cartera:<persona>`: the person's words, relayed by this mod; the prefix says it is not a session
    // to answer
    const { exitCode } = await $.process.run([cfg.send, b.dueno, `cartera:${cfg.persona}`, text])
    if (exitCode === 0) {
      await update($, gone, g => [...g, taskId(b, t)])
      $.ui.toast(`${what} enviado a ${b.dueno}`)
    } else {
      $.ui.toast(`${b.dueno} no está viva: el ${what} no llegó`)
    }
  } catch (err) {
    $.ui.toast(`no pude mandar el ${what}: ${(err as Error).message}`)
  }
}
const resume = (b: Bloque, t: Tarea) => `cartera.sh tarea "${b.bloque}" "${t.tarea}" en-curso`
const sendGo = ($: EngineInterface, b: Bloque, t: Tarea) =>
  reply($, b, t, `GO de ${cfg?.persona} para la tarea "${t.tarea}" del bloque "${b.bloque}": avanza y pásala a en curso (${resume(b, t)}).`, 'GO')
const sendAnswer = async ($: EngineInterface, b: Bloque, t: Tarea, answer: string) => {
  if (answer.trim() === '') return
  await update($, answering, () => '')
  await reply(
    $,
    b,
    t,
    `Respuesta de ${cfg?.persona} a la tarea "${t.tarea}" del bloque "${b.bloque}" (preguntaste: ${t.pregunta ?? ''}):\n${answer}\nSigue con eso y pásala a en curso (${resume(b, t)}).`,
    'respuesta',
  )
}
const archive = async ($: EngineInterface, b: Bloque) => {
  if (!cfg) return
  try {
    const { exitCode, stderr } = await $.process.run([cfg.cartera, 'archivar', b.dueno, b.bloque])
    $.ui.toast(exitCode === 0 ? `archivado: ${b.bloque}` : `no pude archivar: ${String(stderr).trim()}`)
  } catch (err) {
    $.ui.toast(`no pude archivar: ${(err as Error).message}`)
  }
}

// ── the panel session's feed: what changed since its last turn, and the coordinator's new decisions ──
const portfolioDiff = async ($: EngineInterface): Promise<string> => {
  const list = await read($, bloques)
  const before = await read($, snapshot)
  const now: Record<string, string> = {}
  const lines: string[] = []
  for (const b of list) {
    const bid = blockId(b)
    const bstate = b.archivado ? 'archivado' : isDone(b) ? 'terminado' : 'activo'
    now[bid] = `B|${bstate}`
    const wasB = before[bid]
    if (wasB === undefined) lines.push(`+ bloque ${bstate}: ${b.bloque} · ${b.dueno}`)
    else if (wasB !== now[bid]) lines.push(`~ bloque ${wasB.slice(2)} → ${bstate}: ${b.bloque} · ${b.dueno}`)
    if (b.archivado) continue
    for (const t of b.tareas) {
      const id = taskId(b, t)
      now[id] = `${t.estado}|${t.nota ?? ''}`
      const was = before[id]
      if (was === now[id]) continue
      const extra = `${t.espera ? ` (espera ${t.espera})` : ''}${t.nota ? ` — ${t.nota}` : ''}`
      lines.push(
        was === undefined
          ? `  + ${t.estado}: ${b.bloque} › ${t.tarea} · ${b.dueno}${extra}`
          : `  ~ ${was.split('|')[0]} → ${t.estado}: ${b.bloque} › ${t.tarea} · ${b.dueno}${extra}`,
      )
    }
  }
  for (const id of Object.keys(before)) if (!(id in now) && (before[id] ?? '').startsWith('B|')) lines.push(`- bloque salió: ${id}`)
  await update($, snapshot, () => now)
  return lines.length ? `[cartera] cambios desde tu turno anterior:\n${lines.join('\n')}` : ''
}

// decision lines waiting to ride, as context, on the short prompt checkDecisions submits
const pendingDecisions: string[] = []

const checkDecisions = async ($: EngineInterface) => {
  if (!cfg) return
  let text: string
  try {
    text = await $.fs.read(cfg.decisiones)
  } catch {
    return
  }
  const rows = text.split('\n').filter(l => l.trim() !== '')
  const seen = await read($, decisionsSeen)
  if (seen < 0 || rows.length < seen) {
    await update($, decisionsSeen, () => rows.length)
    return
  }
  if (rows.length === seen) return
  const fresh = rows.slice(seen)
  await update($, decisionsSeen, () => rows.length)
  pendingDecisions.push(...fresh)
  // the pointer keeps it working even when the context does not ride (seen 2-nov: the hook did not attach it)
  void $.prompt.submit({
    text: `⚖ ${fresh.length} decisión(es) nueva(s) del coordinador · tail -n ${fresh.length} ${cfg.decisiones}`,
  })
}

// (3-nov: session.attach/detach and $.session.surfaces() were probed: a tmux client and the remote GUI coming and going
// raise nothing and surfaces stays ["terminal"]. Claude Code does not tell a session who is viewing it.)

type Item = { b: Bloque; t: Tarea }
const GROUPS: { clase: Clase; title: string; mark: string }[] = [
  { clase: 'tuya', title: 'Tuyas', mark: '🟡' },
  { clase: 'curso', title: 'En curso', mark: '🟢' },
  { clase: 'parqueada', title: 'Parqueadas', mark: '⚪' },
]

/** Starts reading the board; `fresh` (a turn-on by hand) takes today's board and decisions as already seen. */
const start = async ($: EngineInterface, fresh: boolean): Promise<boolean> => {
  if (!(await configure($))) return false
  active = true
  await load($)
  if (fresh) {
    await update($, decisionsSeen, () => -1)
    await portfolioDiff($)
  }
  await checkDecisions($)
  tick?.cancel()
  tick = $.clock.every(3000, async () => {
    await load($)
    await checkDecisions($)
  })
  return true
}

const stop = () => {
  tick?.cancel()
  tick = null
  active = false
  pendingDecisions.splice(0)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cartera',
      description: 'Turn the portfolio band on or off in this session (off reads nothing)',
      argumentHint: '[on|off]',
    })
    if (await read($, isOn)) await start($, false)
    return next(e)
  })

  on('command.run', { command: 'cartera' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Uso: /cartera [on|off]' }
    const want = arg === '' ? !active : arg === 'on'
    if (want === active) return { text: active ? 'Cartera ya encendida.' : 'Cartera ya apagada.' }
    if (!want) {
      stop()
      await update($, isOn, () => false)
      return { text: 'Cartera apagada: no lee nada en esta sesión.' }
    }
    if (!(await start($, true))) return { text: 'No pude encender la cartera: cartera.sh panel no respondió.' }
    await update($, isOn, () => true)
    return { text: 'Cartera encendida en esta sesión.' }
  })

  // every prompt of the person carries, unseen by them, what moved in the portfolio since the last one
  on('prompt.submit', async ($, e, next) => {
    if (!active) return next(e)
    if (e.origin.kind === 'plugin' && pendingDecisions.length > 0) {
      const lines = pendingDecisions.splice(0)
      const context = `[decisiones] nuevas en ${cfg?.decisiones}:\n${lines.join('\n')}\nEvalúalas como consiglieri. Si alguna es irreversible o choca con un objetivo, llévala a la mesa con ${cfg?.persona} (push si no está). Si no, responde solo "·" y nada más: cada línea tuya se le muestra.`
      return next({ ...e, context: [...(e.context ?? []), context] })
    }
    if (e.command || e.origin.kind === 'plugin') return next(e)
    await load($)
    const diff = await portfolioDiff($)
    return next(diff ? { ...e, context: [...(e.context ?? []), diff] } : e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!active || e.props.hasSurvey) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    // Input exists on the terminal and desktop tables, where this band is drawn; absent elsewhere
    const Input = 'Input' in els ? els.Input : undefined
    const list = (await read($, bloques)).filter(b => !b.archivado && b.tareas.length > 0)
    const rut = await read($, rutinas)
    const err = await read($, error)
    const open = await read($, opened)
    const sent = await read($, gone)
    const asking = await read($, answering)
    if (list.length === 0 && rut.length === 0 && err === '') return next(e)
    const now = await $.clock.now()

    const toggle = (node: string) => update($, opened, o => (o.includes(node) ? o.filter(n => n !== node) : [...o, node]))
    const arrow = (isOpen: boolean) => (isOpen ? '▾' : '▸')
    const groupId = (owner: string, clase: Clase) => `g:${owner}:${clase}`
    const groupOpen = (owner: string, clase: Clase) => (clase === 'parqueada') === open.includes(groupId(owner, clase))

    // the open tasks of the active blocks, by session; a session's finished tasks do not count here
    const items: Item[] = list
      .filter(b => !isDone(b))
      .flatMap(b => b.tareas.filter(t => t.estado !== 'terminado').map(t => ({ b, t })))
    const count = (its: Item[]) => ({
      tuyas: its.filter(i => claseOf(i.t) === 'tuya').length,
      curso: its.filter(i => claseOf(i.t) === 'curso' && !isStale(i.t, now)).length,
      rojas: its.filter(i => isStale(i.t, now)).length,
      parq: its.filter(i => claseOf(i.t) === 'parqueada' && !isStale(i.t, now)).length,
    })
    const owners = [...new Set(items.map(i => i.b.dueno))]
    const of = (owner: string) => items.filter(i => i.b.dueno === owner)
    // who needs looking at goes first: a stuck task, then one waiting for the person, then the rest by name
    const rank = (owner: string) => {
      const c = count(of(owner))
      return c.rojas > 0 ? 0 : c.tuyas > 0 ? 1 : 2
    }
    owners.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y))

    // ⊞ opens everything under a node down to the task titles (no descriptions, no parked); ⊟ closes it all
    const allOpen = (scope: string[], root: boolean) =>
      (!root || open.includes('activos')) &&
      scope.every(o => open.includes(`s:${o}`) && groupOpen(o, 'tuya') && groupOpen(o, 'curso'))
    const clearScope = (o: string[], scope: string[]) =>
      o.filter(n => !scope.some(s => n === `s:${s}` || n.startsWith(`g:${s}:`) || n.startsWith(`t:${s}/`)))
    const expandAll = (scope: string[], root: boolean) =>
      update($, opened, o => {
        const rest = clearScope(o, scope).filter(n => !root || n !== 'activos')
        return allOpen(scope, root) ? rest : [...rest, ...(root ? ['activos'] : []), ...scope.map(s => `s:${s}`)]
      })
    const expander = (key: string, scope: string[], root: boolean) => (
      <Button key={key} plain dimColor onPress={() => expandAll(scope, root)}>
        {' '}{allOpen(scope, root) ? '[⊟]' : '[⊞]'}
      </Button>
    )
    const badges = (its: Item[]) => {
      const c = count(its)
      return (
        <Text>
          {'  '}
          {c.tuyas ? `🟡${c.tuyas} ` : ''}
          {c.curso ? `🟢${c.curso} ` : ''}
          {c.rojas ? `🔴${c.rojas} ` : ''}
          {c.parq ? <Text dimColor>⚪{c.parq}</Text> : ''}
        </Text>
      )
    }

    const taskRow = ({ b, t }: Item) => {
      const id = taskId(b, t)
      const node = `t:${id}`
      const stale = isStale(t, now)
      const clase = claseOf(t)
      let action = <Text>{'        '}</Text>
      if (clase === 'tuya' && sent.includes(id)) action = <Text dimColor>{'      '}✓ </Text>
      else if (t.espera === 'go' && clase === 'tuya')
        action = (
          <Button key={`go:${id}`} plain onPress={() => sendGo($, b, t)}>
            {'      '}<Text color="green">GO</Text>
          </Button>
        )
      else if (t.espera === 'texto' && clase === 'tuya')
        action = (
          <Button key={`ask:${id}`} plain onPress={() => update($, answering, a => (a === id ? '' : id))}>
            {'      '}<Text color="yellow">? </Text>
          </Button>
        )
      const hasDesc = Boolean(t.desc || b.desc)
      const showDesc = open.includes(node) || asking === id
      const hechas = b.tareas.filter(x => x.estado === 'terminado').length
      const detail = [
        t.prioridad ? `prioridad ${t.prioridad}` : '',
        (clase === 'curso' || stale) && t.at !== undefined ? ago(now - t.at) : '',
        clase !== 'tuya' && t.espera ? `espera ${t.espera}` : '',
        t.nota ?? '',
      ].filter(Boolean)
      const row = (
        <Box key={`row:${id}`}>
          {action}
          {hasDesc ? (
            <Button key={`info:${id}`} plain dimColor onPress={() => toggle(node)}>
              {' ⓘ '}
            </Button>
          ) : (
            <Text>{'   '}</Text>
          )}
          <Text color={stale ? 'red' : undefined} dimColor={clase === 'parqueada' && !stale} wrap="truncate-end">
            {stale ? '🔴 ' : ''}
            {t.tarea}
            <Text dimColor>
              {' · '}
              {b.bloque}
              {b.tareas.length > 1 ? ` (${hechas}/${b.tareas.length})` : ''}
              {detail.length ? ` · ${detail.join(' · ')}` : ''}
            </Text>
          </Text>
        </Box>
      )
      const desc = showDesc && hasDesc ? (
        <Box flexDirection="column" paddingLeft={11}>
          {t.desc ? <Text dimColor wrap="wrap">{t.desc}</Text> : null}
          {b.desc && b.desc !== t.desc ? <Text dimColor wrap="wrap">{b.desc}</Text> : null}
        </Box>
      ) : null
      const answerable = asking === id && t.espera === 'texto' && Input
      if (!desc && !answerable) return row
      return (
        <Box key={`task:${id}`} flexDirection="column">
          {row}
          {desc}
          {answerable ? <Text color="yellow" wrap="wrap">{'           '}{t.pregunta ?? ''}</Text> : null}
          {answerable && Input ? (
            <Box>
              <Text>{'           '}</Text>
              <Input key={`ans:${id}`} placeholder="tu respuesta" submitLabel="enviar" autoFocus onSubmit={(v: string) => sendAnswer($, b, t, v)} />
            </Box>
          ) : null}
        </Box>
      )
    }

    const groupRows = (owner: string, its: Item[]) =>
      GROUPS.flatMap(({ clase, title, mark }) => {
        const inGroup = its.filter(i => claseOf(i.t) === clase)
        if (inGroup.length === 0) return []
        const isOpen = groupOpen(owner, clase)
        const head = (
          <Button key={groupId(owner, clase)} plain dimColor={clase === 'parqueada'} onPress={() => toggle(groupId(owner, clase))}>
            {'    '}{arrow(isOpen)} {mark} {title} <Text dimColor>({inGroup.length})</Text>
          </Button>
        )
        if (!isOpen) return [head]
        // the stuck ones first
        const ordered = [...inGroup].sort((x, y) => Number(isStale(y.t, now)) - Number(isStale(x.t, now)))
        return [head, ...ordered.map(taskRow)]
      })

    const sessionRows = (owner: string) => {
      const its = of(owner)
      const node = `s:${owner}`
      const isOpen = open.includes(node)
      const head = (
        <Box key={`head:${node}`}>
          <Button key={node} plain onPress={() => toggle(node)}>
            {'  '}{arrow(isOpen)} {owner}
          </Button>
          {expander(`all:${node}`, [owner], false)}
          {badges(its)}
        </Box>
      )
      return isOpen ? [head, ...groupRows(owner, its)] : [head]
    }

    const doneBlockRows = (b: Bloque) => {
      const node = `b:${blockId(b)}`
      const isOpen = open.includes(node)
      const head = (
        <Box key={`head:${node}`}>
          <Button key={`ok:${node}`} plain dimColor onPress={() => archive($, b)}>
            {'  '}<Text color="green">✔</Text>{' '}
          </Button>
          <Button key={node} plain onPress={() => toggle(node)}>
            {arrow(isOpen)} {b.bloque} <Text dimColor>· {b.dueno} ({b.tareas.length}/{b.tareas.length})</Text>
            {b.desc ? <Text dimColor>  ⓘ</Text> : ''}
          </Button>
        </Box>
      )
      if (!isOpen) return [head]
      return [
        head,
        ...(b.desc ? [<Box key={`desc:${node}`} paddingLeft={8}><Text wrap="wrap">{b.desc}</Text></Box>] : []),
        ...b.tareas.map(t => (
          <Text key={`done:${taskId(b, t)}`} dimColor wrap="truncate-end">
            {'        '}✓ {t.tarea}
            {t.nota ? ` — ${t.nota}` : ''}
          </Text>
        )),
      ]
    }

    const terminados = list
      .filter(isDone)
      .sort((a, b) => a.dueno.localeCompare(b.dueno) || (a.at ?? 0) - (b.at ?? 0))
    const activosOpen = open.includes('activos')
    const terminadosOpen = open.includes('terminados')

    return (
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(Math.max(1, e.props.bodyColumns))}</Text>
        {err !== '' && <Text color="red">{err}</Text>}
        {owners.length > 0 && (
          <Box>
            <Button key="activos" plain onPress={() => toggle('activos')}>
              {arrow(activosOpen)} ● Activos
            </Button>
            {expander('all:activos', owners, true)}
            {badges(items)}
          </Box>
        )}
        {activosOpen && owners.flatMap(sessionRows)}
        {terminados.length > 0 && (
          <Button key="terminados" plain onPress={() => toggle('terminados')}>
            {arrow(terminadosOpen)} ✓ Terminados <Text dimColor>({terminados.length})</Text>
          </Button>
        )}
        {terminadosOpen && terminados.flatMap(doneBlockRows)}
        {rut.length > 0 && (
          <Text dimColor wrap="truncate-end">
            ↻ rutinas: {rut.map(r => r.rutina).join(' · ')}
          </Text>
        )}
      </Box>
    )
  })
}
