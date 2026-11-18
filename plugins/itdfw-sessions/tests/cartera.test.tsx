import { expect, test } from 'claude-code/testing'

// The band of hooks/cartera.tsx against the engine (`claude plugin test .`). The plugin's scripts and the board's
// folder are stood in for; `/cartera` turns the band on or off in the session where it is typed.

const BAND = {
  plugin: 'itdfw-sessions',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 40,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const BOARD = JSON.stringify({
  bloques: [{ bloque: 'Release', at: 1, tareas: [{ tarea: 'Publish', estado: 'pendiente', espera: 'go', at: 1 }] }],
  rutinas: [],
})

/** Stands in for the engine around the mod; `seen` counts what the mod ran and read. */
function engine(on: any) {
  const seen = { runs: [] as string[][], reads: 0 }
  on('command.register', (_: unknown, e: { name: string }) => ({ value: { command: e.name } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 2 }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('fs.list', () => ({ value: [{ name: 'ops.json', kind: 'file' }] }))
  on('fs.read', (_: unknown, e: { path: string }) => {
    seen.reads++
    return { value: e.path.endsWith('ops.json') ? BOARD : '' }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_: unknown, e: { argv: readonly string[] }) => {
    seen.runs.push([...e.argv])
    const panel = (e.argv[0] ?? '').endsWith('/cartera.sh') && e.argv[1] === 'panel'
    const out = panel ? JSON.stringify({ dir: '/board', decisiones: '/board/decisiones.jsonl', persona: 'ana' }) : ''
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return seen
}

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const
/** `/cartera <args>` as the person types it. */
const cmd = (args: string) => ({
  command: 'cartera',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: false, columns: 80 },
})

test('off by default: the session draws no band and runs or reads nothing', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'activos' })).toBeUndefined()
  await ui.unmount()
  expect(seen.runs.length).toBe(0)
  expect(seen.reads).toBe(0)
})

test('/cartera turns it on: the board shows, and GO goes to the owner in the persona name', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  const r = await $.command.run(cmd(''))
  expect(r.text).toBe('Cartera encendida en esta sesión.')
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ key: 'activos' })).toBeDefined()
  await desk.unmount()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'activos' })
  await ui.press({ key: 's:ops' })
  await ui.press({ key: 'go:ops/Release/Publish' })
  await ui.unmount()
  const sent = seen.runs.find(x => (x[0] ?? '').endsWith('/claude-session-msg.sh'))
  expect(sent?.slice(1, 3)).toEqual(['ops', 'cartera:ana'])
  expect(sent?.[3]).toMatch(/^GO de ana para la tarea "Publish" del bloque "Release"/)
})

test('/cartera off turns it off: no band, and drawing reads nothing more', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  await $.command.run(cmd('on'))
  expect((await $.command.run(cmd('off'))).text).toBe('Cartera apagada: no lee nada en esta sesión.')
  const reads = seen.reads
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'activos' })).toBeUndefined()
  await ui.unmount()
  expect(seen.reads).toBe(reads)
  expect((await $.command.run(cmd('off'))).text).toBe('Cartera ya apagada.')
  expect((await $.command.run(cmd('maybe'))).text).toBe('Uso: /cartera [on|off]')
})

test('the choice is kept in the session state: a new start of the same session comes back on', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  await $.command.run(cmd('on'))
  const panels = () => seen.runs.filter(x => x[1] === 'panel').length
  const before = panels()
  await $.session.start(START)
  expect(panels()).toBe(before + 1)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'activos' })).toBeDefined()
  await ui.unmount()
})
