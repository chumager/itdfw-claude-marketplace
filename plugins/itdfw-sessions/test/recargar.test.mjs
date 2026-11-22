import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "cajaritos-recargar.sh")
const agentsFile = () => join(env.root, "agents.json")
const setAgents = rows => writeFileSync(agentsFile(), JSON.stringify(rows))
const waitFor = async (test, cap = 5000) => {
  const end = Date.now() + cap
  while (Date.now() < end) { if (test()) return true; await new Promise(r => setTimeout(r, 20)) }
  return false
}
const sessionFile = (sid, status) => writeFileSync(join(env.sessions, `${sid}.json`), JSON.stringify({sessionId: sid, status}))

beforeEach(() => {
  env = makeEnv()
  env.stub("claude", `case "$1" in agents) cat "$FAKE_AGENTS" ;; esac`)
  env.stub("sleep", "exit 0")
  env.stub("tmux", `case "$1" in
  list-sessions) echo main ;;
  new-window) echo "tmux $*" >> "$FAKE_LOG"; echo "@\${FAKE_WID:-7}" ;;
  *) echo "tmux $*" >> "$FAKE_LOG" ;;
esac`)
})
afterEach(() => env.cleanup())

describe("cajaritos-recargar.sh", () => {
  it("types /reload-plugins and /reload-skills into each live session and closes its window once it is idle", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "busy"}, {name: "gone", id: "g1", sessionId: "sG", status: null}])
    sessionFile("sA", "idle")
    const r = await env.run(SCRIPT, [], {extraEnv: {FAKE_AGENTS: agentsFile()}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "alpha: queued")
    assert.ok(await waitFor(() => env.calls().includes("tmux kill-window -t @7")))
    const calls = env.calls()
    assert.ok(calls.includes("tmux new-window -d -P -F #{window_id} -t main -n rl-a1 claude attach a1"))
    const keys = calls.filter(c => c.startsWith("tmux send-keys"))
    assert.deepEqual(keys, ["tmux send-keys -t @7 /reload-plugins", "tmux send-keys -t @7 Enter", "tmux send-keys -t @7 /reload-skills", "tmux send-keys -t @7 Enter"])
    assert.equal(calls.some(c => c.includes("g1")), false)
  })

  it("a session that is not at rest gets no keys (it may be showing a permission prompt), and its window is closed", async () => {
    setAgents([{name: "busy", id: "b1", sessionId: "sB", status: "busy"}])
    sessionFile("sB", "busy")
    const r = await env.run(SCRIPT, [], {extraEnv: {FAKE_AGENTS: agentsFile()}})
    assert.equal(r.stdout.trim(), "busy: queued")
    assert.ok(await waitFor(() => env.calls().includes("tmux kill-window -t @7")))
    assert.equal(env.calls().some(c => c.startsWith("tmux send-keys")), false)
  })

  it("--solo and --excepto choose the sessions", async () => {
    setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}, {name: "beta", id: "b1", sessionId: "sB", status: "idle"}])
    sessionFile("sA", "idle"); sessionFile("sB", "idle")
    const solo = await env.run(SCRIPT, ["--solo", "beta"], {extraEnv: {FAKE_AGENTS: agentsFile()}})
    assert.equal(solo.stdout.trim(), "beta: queued")
    const excepto = await env.run(SCRIPT, ["--excepto", "beta"], {extraEnv: {FAKE_AGENTS: agentsFile()}})
    assert.equal(excepto.stdout.trim(), "alpha: queued")
  })

  it("exit 1 with no tmux server, 2 on bad usage", async () => {
    env.stub("tmux", "exit 1")
    assert.equal((await env.run(SCRIPT, [], {extraEnv: {FAKE_AGENTS: agentsFile()}})).code, 1)
    assert.equal((await env.run(SCRIPT, ["--nope"])).code, 2)
  })
})
