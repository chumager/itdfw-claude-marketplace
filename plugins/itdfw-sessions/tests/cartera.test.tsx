import { expect, test } from 'claude-code/testing'

// The band of hooks/cartera.tsx against the engine (`claude plugin test .`). The scripts are stood in for: what
// `cartera.sh panel` and `claude-session-name.sh` answer decides whether this session draws the band.

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

/** Stands in for the plugin's scripts and the board's folder; `runs` collects every command the mod ran. */
function engine(on: any, { me, panel }: { me: string; panel: string }) {
  const runs: string[][] = []
  on('command.register', (_: unknown, e: { name: string }) => ({ value: { command: e.name } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 2 }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('fs.list', () => ({ value: [{ name: 'ops.json', kind: 'file' }] }))
  on('fs.read', (_: unknown, e: { path: string }) => ({ value: e.path.endsWith('ops.json') ? BOARD : '' }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_: unknown, e: { argv: readonly string[] }) => {
    runs.push([...e.argv])
    const cmd = e.argv[0] ?? ''
    const out = cmd.endsWith('/cartera.sh') && e.argv[1] === 'panel'
      ? JSON.stringify({ dir: '/board', decisiones: '/board/decisiones.jsonl', panel, persona: 'ana' })
      : cmd.endsWith('/claude-session-name.sh') ? `${me}\n` : ''
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return runs
}

test('a session that is not the panel draws no band and runs nothing but the two lookups', async ($, on) => {
  const runs = engine(on, { me: 'worker', panel: 'lead' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'activos' })).toBeUndefined()
  expect(runs.length).toBe(2)
  await ui.unmount()
})

test('no panel configured: no session draws it', async ($, on) => {
  engine(on, { me: 'lead', panel: '' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'activos' })).toBeUndefined()
  await ui.unmount()
})

test('the panel session draws the board, and GO goes to the owner in the persona name', async ($, on) => {
  const runs = engine(on, { me: 'lead', panel: 'lead' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ key: 'activos' })).toBeDefined()
  await desk.unmount()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'activos' })
  await ui.press({ key: 's:ops' })
  await ui.press({ key: 'go:ops/Release/Publish' })
  await ui.unmount()
  const sent = runs.find(r => (r[0] ?? '').endsWith('/claude-session-msg.sh'))
  expect(sent?.slice(1, 3)).toEqual(['ops', 'cartera:ana'])
  expect(sent?.[3]).toMatch(/^GO de ana para la tarea "Publish" del bloque "Release"/)
})
