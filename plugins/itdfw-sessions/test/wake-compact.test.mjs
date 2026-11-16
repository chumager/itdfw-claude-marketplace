import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync, readFileSync, mkdirSync, rmSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const agentsFile = () => join(env.root, "agents.json")
const setAgents = rows => writeFileSync(agentsFile(), JSON.stringify(rows))

// `claude agents --json [--all]` prints the fixture; `claude --bg --resume <sid>` logs pwd + args and, when
// FAKE_WAKE=1, marks that session alive in the fixture. `claude attach <id>` only logs.
const CLAUDE_STUB = `
case "$1" in
  agents) cat "$FAKE_AGENTS" ;;
  --bg) echo "bg pwd=$PWD args=$*" >> "$FAKE_LOG"
        echo "daemon: resumed $3"
        [ "\${FAKE_WAKE:-0}" = 1 ] && jq --arg s "$3" 'map(if .sessionId == $s then .status = "idle" else . end)' "$FAKE_AGENTS" > "$FAKE_AGENTS.new" && mv "$FAKE_AGENTS.new" "$FAKE_AGENTS" ;;
  attach) echo "attach $2" >> "$FAKE_LOG" ;;
esac`

beforeEach(() => {
  env = makeEnv()
  env.stub("claude", CLAUDE_STUB)
  env.stub("sleep", "exit 0")
})
afterEach(() => env.cleanup())

describe("cajarito-despertar.sh", () => {
  const SCRIPT = join(BIN, "cajarito-despertar.sh")
  const run = (name, extraEnv = {}, opts = {}) => env.run(SCRIPT, name === undefined ? [] : [name], {extraEnv: {FAKE_AGENTS: agentsFile(), ...extraEnv}, ...opts})

  it("exit 2 when no session has that name", async () => {
    setAgents([{name: "other", sessionId: "s1", status: null}])
    const r = await run("ghost")
    assert.equal(r.code, 2)
    assert.match(r.stdout, /no session named 'ghost'/)
  })

  it("exit 0 without resuming anything when the session is already alive", async () => {
    setAgents([{name: "alpha", sessionId: "s1", status: "idle"}])
    const r = await run("alpha")
    assert.equal(r.code, 0)
    assert.match(r.stdout, /alpha is already alive \(s1\)/)
    assert.equal(env.calls().length, 0)
  })

  it("resumes a dead session with --bg --resume <sessionId> and exits 0 when it comes up", async () => {
    setAgents([{name: "alpha", sessionId: "s1", status: null}])
    const r = await run("alpha", {FAKE_WAKE: "1"})
    assert.equal(r.code, 0)
    assert.match(r.stdout, /alpha woke up \(idle\)/)
    assert.match(env.calls()[0], /^bg pwd=\S+ args=--bg --resume s1$/)
  })

  it("exit 1 when the resumed session still shows no state", async () => {
    setAgents([{name: "alpha", sessionId: "s1", status: null}])
    const r = await run("alpha")
    assert.equal(r.code, 1)
    assert.match(r.stdout, /alpha did not wake up \(state: null\)/)
  })

  it("with several dead sessions of the same name it warns and wakes the most recent", async () => {
    setAgents([
      {name: "alpha", sessionId: "old", status: null, updatedAt: 1},
      {name: "alpha", sessionId: "new", status: null, updatedAt: 9},
    ])
    const r = await run("alpha", {FAKE_WAKE: "1"})
    assert.equal(r.code, 0)
    assert.match(r.stdout, /warning: 2 sessions named 'alpha', waking the most recent \(new\)/)
    assert.match(env.calls()[0], /--resume new$/)
  })

  it("with several of the same name, one alive wins and nothing is resumed", async () => {
    setAgents([
      {name: "alpha", sessionId: "dead", status: null, updatedAt: 9},
      {name: "alpha", sessionId: "live", status: "idle", updatedAt: 1},
    ])
    const r = await run("alpha")
    assert.equal(r.code, 0)
    assert.match(r.stdout, /already alive \(live\)/)
    assert.equal(env.calls().length, 0)
  })

  it("resumes from CAJARITO_REPO when set, from the current directory otherwise", async () => {
    setAgents([{name: "alpha", sessionId: "s1", status: null}])
    const repo = join(env.root, "repo")
    mkdirSync(repo)
    await run("alpha", {FAKE_WAKE: "1", CAJARITO_REPO: repo})
    setAgents([{name: "alpha", sessionId: "s1", status: null}])
    const here = join(env.root, "here")
    mkdirSync(here)
    await run("alpha", {FAKE_WAKE: "1"}, {cwd: here})
    const [first, second] = env.calls().map(l => l.match(/pwd=(\S+)/)[1])
    assert.equal(first, repo)
    assert.equal(second, here)
  })

  it("exit 1 when the name argument is missing", async () => {
    const r = await run(undefined)
    assert.equal(r.code, 1)
    assert.match(r.stderr, /usage: cajarito-despertar\.sh <session name>/)
  })
})

describe("cajaritos-compactar.sh", () => {
  const SCRIPT = join(BIN, "cajaritos-compactar.sh")
  const ctx = (sid, used) => writeFileSync(join(env.state, `ctx-${sid}.json`), JSON.stringify({used}))
  const ctxOf = sid => JSON.parse(readFileSync(join(env.state, `ctx-${sid}.json`), "utf8")).used
  // tmux stub: `send-keys ... Enter` drops the FAKE_COMPACT session to 12 %; FAKE_DUP_NAME=1 makes any name target ambiguous.
  const TMUX_STUB = `
target() { while [ $# -gt 0 ]; do [ "$1" = -t ] && { echo "$2"; return; }; shift; done; }
ambiguous() { [ "\${FAKE_DUP_NAME:-0}" = 1 ] && case "$(target "$@")" in @*) return 1 ;; *) return 0 ;; esac; return 1; }
case "$1" in
  list-sessions) [ "\${FAKE_NO_TMUX:-0}" = 1 ] || echo main ;;
  new-window) echo "tmux $*" >> "$FAKE_LOG"; [ "\${FAKE_NO_WINDOW_ID:-0}" = 1 ] || echo "@\${FAKE_WINDOW_ID:-72}" ;;
  kill-window) echo "tmux $*" >> "$FAKE_LOG"; ambiguous "$@" && { echo "can't find window: $(target "$@")" >&2; exit 1; }; exit 0 ;;
  send-keys) echo "tmux $*" >> "$FAKE_LOG"
             ambiguous "$@" && { echo "can't find window: $(target "$@")" >&2; exit 1; }
             if [ "\${@: -1}" = Enter ] && [ -n "\${FAKE_COMPACT_FILE:-}" ]; then echo '{"used":12}' > "$FAKE_COMPACT_FILE"; fi ;;
esac`
  const base = () => ({FAKE_AGENTS: agentsFile()})
  const taskDir = sid => join("/tmp", `claude-${process.getuid()}`, "isx-test", sid, "tasks")

  beforeEach(() => env.stub("tmux", TMUX_STUB))

  it("compacts an idle session over the threshold: attach, /compact, wait, close the window; reports before -> after", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, [], {extraEnv: {...base(), FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "alpha: 70% -> 12% (idle)")
    const calls = env.calls()
    assert.ok(calls.includes("tmux new-window -d -P -F #{window_id} -t main -n cmp-a1 claude attach a1"))
    assert.ok(calls.includes("tmux send-keys -t @72 /compact"))
    assert.ok(calls.includes("tmux send-keys -t @72 Enter"))
    assert.ok(calls.includes("tmux kill-window -t @72"))
    assert.equal(ctxOf("sA"), 12)
  })

  it("talks to the window by the id new-window returned, never by session:name", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, ["--modelo", "opus"], {extraEnv: {...base(), FAKE_WINDOW_ID: "91", FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 12% (idle, model opus)")
    const targeted = env.calls().filter(c => /^tmux (send-keys|kill-window) /.test(c))
    assert.equal(targeted.length, 5)
    for (const c of targeted) assert.match(c, /^tmux (send-keys|kill-window) -t @91( |$)/)
    assert.equal(env.calls().some(c => c.includes("main:cmp-")), false)
  })

  it("compacts even when a leftover window already has the same name (name targets are ambiguous, the id is not)", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, [], {extraEnv: {...base(), FAKE_DUP_NAME: "1", FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 12% (idle)")
    assert.equal(ctxOf("sA"), 12)
    assert.ok(env.calls().includes("tmux kill-window -t @72"))
  })

  it("reports the session and moves on, sending no keys, when new-window returns no id", async () => {
    setAgents([
      {name: "alpha", id: "a1", sessionId: "sA", status: "idle"},
      {name: "beta", id: "b1", sessionId: "sB", status: "idle"},
    ])
    ctx("sA", 70); ctx("sB", 70)
    const r = await env.run(SCRIPT, [], {extraEnv: {...base(), FAKE_NO_WINDOW_ID: "1"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "alpha: 70% but tmux gave no window id, skipping\nbeta: 70% but tmux gave no window id, skipping")
    assert.equal(env.calls().filter(c => c.startsWith("tmux new-window")).length, 2)
    assert.equal(env.calls().some(c => /^tmux (send-keys|kill-window)/.test(c)), false)
  })

  it("leaves alone the sessions under the threshold, with no ctx file, or not alive", async () => {
    setAgents([
      {name: "low", id: "l1", sessionId: "sL", status: "idle"},
      {name: "noctx", id: "n1", sessionId: "sN", status: "idle"},
      {name: "dead", id: "d1", sessionId: "sD", status: null},
    ])
    ctx("sL", 49); ctx("sD", 90)
    const r = await env.run(SCRIPT, [], {extraEnv: base()})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    assert.equal(env.calls().length, 0)
  })

  it("--umbral moves the threshold", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 30)
    const r = await env.run(SCRIPT, ["--umbral", "25"], {extraEnv: {...base(), FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.match(r.stdout, /^alpha: 30% -> 12%/)
  })

  it("skips a session that is not idle, and says so", async () => {
    setAgents([{name: "busy", id: "b1", sessionId: "sB", status: "working"}])
    ctx("sB", 80)
    const r = await env.run(SCRIPT, [], {extraEnv: base()})
    assert.equal(r.stdout.trim(), "busy: 80% but it is working, skipping")
    assert.equal(env.calls().length, 0)
  })

  it("skips an idle session with task files touched in the last 10 minutes", async () => {
    const dir = taskDir("sT")
    mkdirSync(dir, {recursive: true})
    try {
      writeFileSync(join(dir, "t1"), "")
      setAgents([{name: "tasky", id: "t1", sessionId: "sT", status: "idle"}])
      ctx("sT", 80)
      const r = await env.run(SCRIPT, [], {extraEnv: base()})
      assert.equal(r.stdout.trim(), "tasky: 80% but it has active tasks, skipping")
      assert.equal(env.calls().length, 0)
    } finally { rmSync(join("/tmp", `claude-${process.getuid()}`, "isx-test"), {recursive: true, force: true}) }
  })

  it("--excepto skips a name; --solo restricts to a name", async () => {
    setAgents([
      {name: "alpha", id: "a1", sessionId: "sA", status: "idle"},
      {name: "beta", id: "b1", sessionId: "sB", status: "idle"},
    ])
    ctx("sA", 70); ctx("sB", 70)
    const only = await env.run(SCRIPT, ["--solo", "beta"], {extraEnv: {...base(), FAKE_COMPACT_FILE: join(env.state, "ctx-sB.json")}})
    assert.match(only.stdout, /^beta: 70% -> 12%/)
    assert.equal(only.stdout.includes("alpha"), false)
    const except = await env.run(SCRIPT, ["--excepto", "beta"], {extraEnv: {...base(), FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.match(except.stdout, /^alpha: 70% -> 12%/)
    assert.equal(except.stdout.includes("beta"), false)
  })

  it("reports the unchanged percentage when the compaction does not bring it down", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, [], {extraEnv: base()})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 70% (idle)")
  })

  it("--modelo switches the model after a compaction that worked, before closing the window", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, ["--modelo", "opus"], {extraEnv: {...base(), FAKE_COMPACT_FILE: join(env.state, "ctx-sA.json")}})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 12% (idle, model opus)")
    const calls = env.calls()
    const model = calls.indexOf("tmux send-keys -t @72 /model opus")
    assert.ok(model > calls.indexOf("tmux send-keys -t @72 /compact"))
    assert.ok(model < calls.indexOf("tmux kill-window -t @72"))
  })

  it("--modelo leaves the model alone when the compaction did not bring the % down", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    ctx("sA", 70)
    const r = await env.run(SCRIPT, ["--modelo", "opus"], {extraEnv: base()})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 70% (idle)")
    assert.equal(env.calls().some(c => c.includes("/model")), false)
  })

  it("reads the ctx files from CLAUDE_STATE_DIR when set", async () => {
    const dir = join(env.root, "elsewhere")
    mkdirSync(dir)
    writeFileSync(join(dir, "ctx-sA.json"), JSON.stringify({used: 70}))
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
    const r = await env.run(SCRIPT, [], {extraEnv: {...base(), CLAUDE_STATE_DIR: dir, FAKE_COMPACT_FILE: join(dir, "ctx-sA.json")}})
    assert.equal(r.stdout.trim(), "alpha: 70% -> 12% (idle)")
  })

  it("exit 1 when there is no tmux server", async () => {
    setAgents([])
    const r = await env.run(SCRIPT, [], {extraEnv: {...base(), FAKE_NO_TMUX: "1"}})
    assert.equal(r.code, 1)
    assert.equal(r.stdout.trim(), "no tmux server: cannot attach")
  })

  it("exit 2 and a usage line on an unknown option", async () => {
    const r = await env.run(SCRIPT, ["--bogus"], {extraEnv: base()})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /^usage: cajaritos-compactar\.sh/)
  })
})
