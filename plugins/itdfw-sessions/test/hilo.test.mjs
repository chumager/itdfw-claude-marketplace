import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync, readFileSync, mkdirSync, existsSync, utimesSync} from "node:fs"
import {join} from "node:path"
import {setTimeout as wait} from "node:timers/promises"
import {BIN, makeEnv, messageOf} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const line = o => JSON.stringify(o)
const transcript = entries => {
  const f = join(env.root, "t.jsonl")
  writeFileSync(f, entries.map(line).join("\n") + "\n")
  return f
}
const user = text => ({type: "user", message: {role: "user", content: text}})
const assistant = text => ({type: "assistant", message: {role: "assistant", content: [{type: "text", text}, {type: "tool_use", name: "Bash", input: {}}]}})

describe("hilo-capturar.sh", () => {
  const SCRIPT = join(BIN, "hilo-capturar.sh")

  it("keeps the person's text, other sessions' messages and the assistant's text; drops tool results and meta entries; prints nothing", async () => {
    await env.session({name: "alpha"})
    const tr = transcript([
      user("first question"),
      assistant("first answer"),
      {type: "user", message: {role: "user", content: [{type: "tool_result", content: "TOOL OUTPUT"}]}},
      {type: "user", isMeta: true, message: {role: "user", content: "<local-command-caveat>META</local-command-caveat>"}},
      {type: "user", isMeta: true, message: {role: "user", content: "Another Claude session sent a message: hi from beta"}},
      {type: "system", content: "SYSTEM"},
    ])
    const r = await env.run(SCRIPT, [], {stdin: line({session_id: "sid-alpha", transcript_path: tr})})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    const out = readFileSync(join(env.state, "hilo", "alpha.ultimos.md"), "utf8")
    for (const s of ["## Usuario\nfirst question", "## Asistente\nfirst answer", "## Otra sesión\nAnother Claude session sent a message: hi from beta"]) assert.ok(out.includes(s), s)
    for (const s of ["TOOL OUTPUT", "META", "SYSTEM"]) assert.ok(!out.includes(s), s)
  })

  it("keeps only the last HILO_MENSAJES messages, a message with its own newlines and headings counting as one", async () => {
    const tr = transcript([user("m1"), user("m2\n## not a new message\nstill m2"), user("m3")])
    await env.run(SCRIPT, [], {stdin: line({session_id: "sid-x", transcript_path: tr}), extraEnv: {HILO_MENSAJES: "2"}})
    const out = readFileSync(join(env.state, "hilo", "sid-x.ultimos.md"), "utf8")
    assert.ok(!out.includes("m1"))
    assert.ok(out.includes("m2\n## not a new message\nstill m2") && out.includes("m3"))
  })

  it("cuts each message at HILO_MAX_MENSAJE characters and says how much was cut", async () => {
    const tr = transcript([user("x".repeat(50)), assistant("short")])
    await env.run(SCRIPT, [], {stdin: line({session_id: "sid-x", transcript_path: tr}), extraEnv: {HILO_MAX_MENSAJE: "10"}})
    const out = readFileSync(join(env.state, "hilo", "sid-x.ultimos.md"), "utf8")
    assert.ok(out.includes("## Usuario\n" + "x".repeat(10) + "\n[… cortado: 40 caracteres más]"))
    assert.ok(out.includes("## Asistente\nshort"))
  })

  it("exit 0 and no file when the input has no readable transcript", async () => {
    const r = await env.run(SCRIPT, [], {stdin: line({session_id: "sid-x", transcript_path: "/nope"})})
    assert.equal(r.code, 0)
    assert.equal(existsSync(join(env.state, "hilo", "sid-x.ultimos.md")), false)
  })
})

describe("hilo-devolver.sh", () => {
  const SCRIPT = join(BIN, "hilo-devolver.sh")
  const hilo = () => { const d = join(env.state, "hilo"); mkdirSync(d, {recursive: true}); return d }

  it("sends the summary and the last messages to the session, from hook:hilo, after returning at once", async () => {
    const a = await env.session({name: "alpha"})
    writeFileSync(join(hilo(), "alpha.md"), "MY SUMMARY")
    writeFileSync(join(hilo(), "alpha.ultimos.md"), "LAST MESSAGES")
    const r = await env.run(SCRIPT, [], {stdin: line({session_id: "sid-alpha"}), extraEnv: {HILO_ESPERA: "0"}})
    assert.equal(r.code, 0)
    for (let i = 0; i < 40 && a.received.length < 2; i++) await wait(50)
    const m = messageOf(a)
    assert.match(m, /from="hook:hilo"/)
    assert.ok(m.includes("MY SUMMARY") && m.includes("LAST MESSAGES"))
  })

  it("leaves out a summary older than 24 h", async () => {
    const a = await env.session({name: "alpha"})
    const old = join(hilo(), "alpha.md")
    writeFileSync(old, "OLD SUMMARY")
    const t = new Date(Date.now() - 2 * 864e5); utimesSync(old, t, t)
    writeFileSync(join(hilo(), "alpha.ultimos.md"), "LAST MESSAGES")
    await env.run(SCRIPT, [], {stdin: line({session_id: "sid-alpha"}), extraEnv: {HILO_ESPERA: "0"}})
    for (let i = 0; i < 40 && a.received.length < 2; i++) await wait(50)
    assert.ok(!messageOf(a).includes("OLD SUMMARY") && messageOf(a).includes("LAST MESSAGES"))
  })

  it("sends nothing to a session without a name, or when there is nothing to hand back", async () => {
    const a = await env.session({name: "alpha"})
    for (const sid of ["sid-nobody", "sid-alpha"]) {
      assert.equal((await env.run(SCRIPT, [], {stdin: line({session_id: sid}), extraEnv: {HILO_ESPERA: "0"}})).code, 0)
    }
    await wait(300)
    assert.equal(a.received.length, 0)
  })
})

describe("hilo-listo.sh", () => {
  const SCRIPT = join(BIN, "hilo-listo.sh")

  it("--ruta prints where the session writes its summary", async () => {
    await env.session({name: "alpha", pid: process.pid})
    const r = await env.run(SCRIPT, ["--ruta"])
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), join(env.state, "hilo", "alpha.md"))
  })

  it("exit 1 and no mark without a recent summary; with one, it marks the session as ready to compact", async () => {
    await env.session({name: "alpha", pid: process.pid})
    assert.equal((await env.run(SCRIPT)).code, 1)
    assert.equal(existsSync(join(env.state, "compactables", "alpha")), false)
    mkdirSync(join(env.state, "hilo"), {recursive: true})
    writeFileSync(join(env.state, "hilo", "alpha.md"), "summary")
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 0)
    assert.ok(existsSync(join(env.state, "compactables", "alpha")))
  })

  it("exit 1 when not under a named session; exit 2 on an unknown argument", async () => {
    assert.equal((await env.run(SCRIPT)).code, 1)
    assert.equal((await env.run(SCRIPT, ["--x"])).code, 2)
  })
})

describe("hilo-pedir.sh", () => {
  const SCRIPT = join(BIN, "hilo-pedir.sh")
  const ctx = (name, used) => writeFileSync(join(env.state, `ctx-sid-${name}.json`), line({used}))
  const agents = rows => {
    const f = join(env.root, "agents.json")
    writeFileSync(f, line(rows))
    env.stub("claude", `[ "$1" = agents ] && cat "${f}"`)
  }

  it("asks only the live sessions at or over the threshold, minus --excepto; the others get nothing", async () => {
    const hi = await env.session({name: "hi"}), lo = await env.session({name: "lo"}), me = await env.session({name: "me"})
    const dead = await env.session({name: "dead"})
    agents([
      {name: "hi", sessionId: "sid-hi", status: "idle"}, {name: "lo", sessionId: "sid-lo", status: "idle"},
      {name: "me", sessionId: "sid-me", status: "idle"}, {name: "dead", sessionId: "sid-dead", status: null},
    ])
    ctx("hi", 62); ctx("lo", 30); ctx("me", 70); ctx("dead", 90)
    const r = await env.run(SCRIPT, ["--excepto", "me"])
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "asked hi (62%)")
    assert.match(messageOf(hi), /from="script:hilo"[^]*hilo\/hi\.md[^]*hilo-listo\.sh/)
    for (const s of [lo, me, dead]) assert.equal(s.received.length, 0)
  })

  it("--umbral and --solo choose the sessions; exit 2 on an unknown option", async () => {
    const a = await env.session({name: "a"}), b = await env.session({name: "b"})
    agents([{name: "a", sessionId: "sid-a", status: "idle"}, {name: "b", sessionId: "sid-b", status: "busy"}])
    ctx("a", 20); ctx("b", 20)
    const r = await env.run(SCRIPT, ["--umbral", "10", "--solo", "b"])
    assert.equal(r.stdout.trim(), "asked b (20%)")
    assert.equal(a.received.length, 0)
    assert.equal((await env.run(SCRIPT, ["--nope"])).code, 2)
  })
})
