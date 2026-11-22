import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, mkdirSync, utimesSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "cajaritos-reposo.sh")
// A session file whose status changed `mins` minutes ago, and its context %.
const session = (name, status, mins, used) => {
  const sid = `s-${name}`
  writeFileSync(join(env.sessions, `${sid}.json`), JSON.stringify({name, sessionId: sid, status, statusUpdatedAt: Date.now() - mins * 60000}))
  if (used !== undefined) writeFileSync(join(env.state, `ctx-${sid}.json`), JSON.stringify({used}))
}
const mark = name => { mkdirSync(join(env.state, "compactables"), {recursive: true}); writeFileSync(join(env.state, "compactables", name), "x") }
const run = (args = [], extra = {}) => env.run(SCRIPT, args, {extraEnv: {CLAUDE_STATE_DIR: env.state, CAJARITOS_BIN: env.stubs, ...extra}})

beforeEach(() => {
  env = makeEnv()
  env.stub("hilo-pedir.sh", `echo "hilo-pedir $*" >> "$FAKE_LOG"`)
  env.stub("cajaritos-compactar.sh", `echo "compactar $*" >> "$FAKE_LOG"; echo "\${FAKE_COMPACT_OUT:-x: 80% -> 3% (idle)}"`)
})
afterEach(() => env.cleanup())

describe("cajaritos-reposo.sh", () => {
  it("asks a session at rest 30-55 min over the threshold, once, and leaves the rest alone", async () => {
    session("warm", "idle", 40, 70)
    session("shelly", "shell", 35, 60)
    session("small", "idle", 40, 20)
    session("fresh", "idle", 10, 90)
    session("cold", "idle", 300, 90)
    session("working", "busy", 40, 90)
    const r = await run()
    assert.equal(r.code, 0)
    assert.deepEqual(r.stdout.trim().split("\n").sort(), ["asked shelly (60%)", "asked warm (70%)"])
    const calls = env.calls()
    assert.ok(calls.includes("hilo-pedir --solo warm --umbral 50 --motivo Llevas un rato en reposo"))
    assert.equal(calls.length, 2)
    const again = await run()
    assert.equal(again.stdout, "")
  })

  it("compacts a marked session at rest, trusting its own status, and deletes the mark", async () => {
    session("done", "shell", 3, 80); mark("done")
    const r = await run()
    assert.match(r.stdout, /^compacted done: /)
    assert.deepEqual(env.calls(), ["compactar --solo done --umbral 0 --quieto 1 --aunque-ocupada"])
    assert.equal(existsSync(join(env.state, "compactables", "done")), false)
  })

  it("keeps the mark when the compaction did not take, and does not touch a marked session still busy or just idle", async () => {
    session("stuck", "idle", 5, 80); mark("stuck")
    session("writing", "busy", 5, 80); mark("writing")
    session("justnow", "idle", 1, 80); mark("justnow")
    const r = await run([], {FAKE_COMPACT_OUT: "stuck: 80% -> 80% (idle, NOT compacted)"})
    assert.match(r.stdout.trim(), /^not compacted stuck: /)
    assert.equal(env.calls().length, 1)
    for (const n of ["stuck", "writing", "justnow"]) assert.ok(existsSync(join(env.state, "compactables", n)))
  })

  it("drops a mark left by an earlier ritual (the session worked after it) instead of compacting", async () => {
    session("old", "idle", 20, 30); mark("old")
    const past = new Date(Date.now() - 5 * 3600 * 1000)
    utimesSync(join(env.state, "compactables", "old"), past, past)
    const r = await run()
    assert.equal(r.stdout.trim(), "dropped the stale mark of old")
    assert.deepEqual(env.calls(), [])
    assert.equal(existsSync(join(env.state, "compactables", "old")), false)
  })

  it("--seco does nothing; bad usage exits 2", async () => {
    session("warm", "idle", 40, 70)
    session("done", "idle", 3, 80); mark("done")
    const r = await run(["--seco"])
    assert.deepEqual(r.stdout.trim().split("\n").sort(), ["would ask warm (70%, at rest 40 min)", "would compact done (at rest 3 min)"])
    assert.deepEqual(env.calls(), [])
    assert.equal((await run(["--quieto", "x"])).code, 2)
  })
})
