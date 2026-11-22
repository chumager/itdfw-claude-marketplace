import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "cajarito-teclear.sh")
const agentsFile = () => join(env.root, "agents.json")
const setAgents = rows => writeFileSync(agentsFile(), JSON.stringify(rows))
const sessionFile = (sid, status) => writeFileSync(join(env.sessions, `${sid}.json`), JSON.stringify({sessionId: sid, status}))
const waitFor = async (test, cap = 5000) => {
  const end = Date.now() + cap
  while (Date.now() < end) { if (test()) return true; await new Promise(r => setTimeout(r, 20)) }
  return false
}
const run = args => env.run(SCRIPT, args, {extraEnv: {FAKE_AGENTS: agentsFile()}})
const keys = () => env.calls().filter(c => c.startsWith("tmux send-keys"))

beforeEach(() => {
  env = makeEnv()
  env.stub("claude", `case "$1" in agents) cat "$FAKE_AGENTS" ;; esac`)
  env.stub("sleep", "exit 0")
  env.stub("tmux", `case "$1" in
  list-sessions) echo main ;;
  new-window) echo "tmux $*" >> "$FAKE_LOG"; echo "@7" ;;
  *) echo "tmux $*" >> "$FAKE_LOG" ;;
esac`)
  setAgents([{name: "alpha", id: "a1", sessionId: "sA", status: "idle"}])
})
afterEach(() => env.cleanup())

describe("cajarito-teclear.sh", () => {
  it("finds the session by name, types each line literally with newlines turned into spaces, logs it and closes the window", async () => {
    sessionFile("sA", "idle")
    const r = await run(["alpha", "Apruebo que ejecutes: git push\norigin develop", "Enter"])
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "alpha: queued")
    assert.ok(await waitFor(() => env.calls().includes("tmux kill-window -t @7")))
    assert.ok(env.calls().includes("tmux new-window -d -P -F #{window_id} -t main -n rl-a1 claude attach a1"))
    assert.deepEqual(keys(), [
      "tmux send-keys -t @7 -l Apruebo que ejecutes: git push origin develop",
      "tmux send-keys -t @7 Enter",
      "tmux send-keys -t @7 -l Enter",
      "tmux send-keys -t @7 Enter"
    ])
    const log = readFileSync(join(env.state, "teclear.log"), "utf8").trim().split("\n")
    assert.equal(log.length, 2)
    assert.match(log[0], /\talpha\tApruebo que ejecutes: git push origin develop$/)
  })

  it("a session that is not at rest gets no keys and no log line (it may be showing a permission prompt)", async () => {
    sessionFile("sA", "busy")
    const r = await run(["--espera", "1", "a1", "/reload-plugins"])
    assert.equal(r.stdout.trim(), "alpha: queued")
    assert.ok(await waitFor(() => env.calls().includes("tmux kill-window -t @7")))
    assert.deepEqual(keys(), [])
    assert.equal(existsSync(join(env.state, "teclear.log")), false)
  })

  it("an unknown session is exit 1 with no window; bad usage is exit 2", async () => {
    const r = await run(["nobody", "hola"])
    assert.equal(r.code, 1)
    assert.match(r.stdout, /nobody: no live session/)
    assert.equal(env.calls().some(c => c.includes("new-window")), false)
    assert.equal((await run(["alpha"])).code, 2)
    assert.equal((await run(["--espera", "x", "alpha", "hola"])).code, 2)
  })
})
