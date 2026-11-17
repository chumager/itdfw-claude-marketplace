import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync, readFileSync, mkdirSync, existsSync} from "node:fs"
import {join} from "node:path"
import {BIN, EXAMPLES, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("session-fg.sh", () => {
  const SCRIPT = join(BIN, "session-fg.sh")
  const TEXT_A = "The deployment finished without errors on every host"
  const TEXT_B = "Nothing else is pending in the queue right now ok"

  // tmux stub: panes %1 (inactive) and %2 (active) of the asked window; the screen of pane N is $FAKE_SCREEN_N.
  const TMUX_STUB = `
case "$1" in
  display-message) echo "main:0" ;;
  list-panes) echo "list-panes $*" >> "$FAKE_LOG"; printf '%%1 0\\n%%2 1\\n' ;;
  capture-pane) pane="\${@: -1}"; v="FAKE_SCREEN_\${pane#%}"; printf '%s\\n' "\${!v:-}" ;;
esac`

  const transcript = (name, texts) => {
    const dir = join(env.claude, "projects", "proj")
    mkdirSync(dir, {recursive: true})
    const lines = texts.map(t => JSON.stringify({type: "assistant", message: {content: [{type: "text", text: t}]}}))
    writeFileSync(join(dir, `sid-${name}.jsonl`), lines.join("\n") + "\n")
  }
  const register = async name => env.session({name, socket: false})
  const run = (args, extraEnv = {}) => env.run(SCRIPT, args, {extraEnv})

  beforeEach(() => env.stub("tmux", TMUX_STUB))

  it("ACTIVE <pane>, exit 0: the last text is on the active pane", async () => {
    await register("alpha"); transcript("alpha", [TEXT_A])
    const r = await run(["alpha", "main:0"], {FAKE_SCREEN_2: `$ ls\n${TEXT_A}\n$`})
    assert.equal(r.stdout, "ACTIVE %2\n")
    assert.equal(r.code, 0)
  })

  it("VISIBLE <pane>, exit 1: it is on screen in another pane", async () => {
    await register("alpha"); transcript("alpha", [TEXT_A])
    const r = await run(["alpha", "main:0"], {FAKE_SCREEN_1: TEXT_A})
    assert.equal(r.stdout, "VISIBLE %1\n")
    assert.equal(r.code, 1)
  })

  it("BG, exit 3: it is on screen nowhere", async () => {
    await register("alpha"); transcript("alpha", [TEXT_A])
    const r = await run(["alpha", "main:0"], {FAKE_SCREEN_1: TEXT_B, FAKE_SCREEN_2: "$"})
    assert.equal(r.stdout, "BG\n")
    assert.equal(r.code, 3)
  })

  it("matches on the markdown-stripped text (the terminal renders `code` and **bold** without marks)", async () => {
    await register("alpha"); transcript("alpha", ["The **deployment** finished with `zero` errors on every host"])
    const r = await run(["alpha", "main:0"], {FAKE_SCREEN_2: "The deployment finished with zero errors on every host"})
    assert.equal(r.code, 0)
  })

  it("exit 2: no such session, no transcript, or no text long enough to look for", async () => {
    const none = await run(["ghost", "main:0"])
    assert.equal(none.code, 2)
    assert.match(none.stderr, /no session 'ghost'/)
    await register("alpha")
    const noLog = await run(["alpha", "main:0"])
    assert.equal(noLog.code, 2)
    assert.match(noLog.stderr, /no transcript for 'alpha'/)
    transcript("alpha", ["short"])
    const noProbe = await run(["alpha", "main:0"])
    assert.equal(noProbe.code, 2)
    assert.match(noProbe.stderr, /no footprints to look for in 'alpha'/)
  })

  it("window: second argument, then SESSION_FG_WINDOW, then the current tmux window", async () => {
    await register("alpha"); transcript("alpha", [TEXT_A])
    await run(["alpha", "w:1"])
    await run(["alpha"], {SESSION_FG_WINDOW: "w:2"})
    await run(["alpha"])
    const asked = env.calls().map(l => l.match(/-t (\S+)/)[1])
    assert.deepEqual(asked, ["w:1", "w:2", "main:0"])
  })

  it("exit 2 when there is no window to look in (no tmux answer)", async () => {
    env.stub("tmux", "exit 1")
    await register("alpha"); transcript("alpha", [TEXT_A])
    const r = await run(["alpha"])
    assert.equal(r.code, 2)
    assert.match(r.stderr, /no tmux window to look in/)
  })
})

describe("claude-usage-watch.sh", () => {
  const SCRIPT = join(BIN, "claude-usage-watch.sh")
  // the script resets PATH to $HOME/.local/bin:/usr/local/bin:/usr/bin:/bin, so the claude stub lives in $HOME/.local/bin
  const stubClaude = result => env.stub("claude", `echo '${JSON.stringify({result})}'`, join(env.home, ".local", "bin"))
  const USAGE_TEXT = "Current week (all models): 23% used · resets 14:00 (UTC)\nCurrent week (fable): 4% used"
  const logOf = () => readFileSync(join(env.state, "usage.log"), "utf8")

  it("without usage-week: reads the percent and reset from the /usage text; writes usage.log and usage-fable", async () => {
    stubClaude(USAGE_TEXT)
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^\d\d:\d\d {2}semana: 23% \(reset 14:00 \(UTC\) ?\) {2}fable: 4%\n$/)
    assert.match(logOf(), /^\d{4}-\d\d-\d\d \d\d:\d\d {2}semana: 23% /)
    assert.equal(readFileSync(join(env.state, "usage-fable"), "utf8"), "4%")
  })

  it("with a stale usage-week left by an idle session: the /usage percent wins, reset is formatted from the epoch", async () => {
    stubClaude(USAGE_TEXT)
    writeFileSync(join(env.state, "usage-week"), "61.4 1700000000\n")
    const r = await env.run(SCRIPT)
    assert.match(r.stdout, /semana: 23% \(reset Tue 22:13\)/)
  })

  it("when the /usage text has no week: the usage-week percent is the fallback", async () => {
    stubClaude("Current week (fable): 4% used")
    writeFileSync(join(env.state, "usage-week"), "61.4 1700000000\n")
    const r = await env.run(SCRIPT)
    assert.match(r.stdout, /semana: 61% \(reset Tue 22:13\) {2}fable: 4%/)
  })

  it("shows '?' for what the /usage text does not have", async () => {
    stubClaude("nothing useful here")
    const r = await env.run(SCRIPT)
    assert.match(r.stdout, /semana: \? \(reset \?\) {2}fable: \?\n$/)
  })

  it("exit 1 and 'no answer from claude -p' when claude gives nothing; no log line", async () => {
    env.stub("claude", "exit 0", join(env.home, ".local", "bin"))
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 1)
    assert.match(r.stdout, /^\d\d:\d\d {2}no answer from claude -p\n$/)
    assert.equal(existsSync(join(env.state, "usage.log")), false)
  })

  it("CLAUDE_STATE_DIR relocates the log and the files", async () => {
    stubClaude(USAGE_TEXT)
    const dir = join(env.root, "other-state")
    await env.run(SCRIPT, [], {extraEnv: {CLAUDE_STATE_DIR: dir}})
    assert.ok(existsSync(join(dir, "usage.log")))
    assert.ok(existsSync(join(dir, "usage-fable")))
  })
})

describe("examples/statusline-state.sh", () => {
  const SCRIPT = join(EXAMPLES, "statusline-state.sh")
  const INPUT = JSON.stringify({
    session_id: "abc", context_window: {used_percentage: 42, context_window_size: 200000},
    model: {display_name: "M"}, effort: {level: "high"},
    rate_limits: {seven_day: {used_percentage: 17.5, resets_at: 1700000000}},
  })

  it("leaves ctx-<sessionId>.json (the file cajaritos-compactar.sh reads) and usage-week (claude-usage-watch.sh)", async () => {
    const r = await env.run(SCRIPT, [], {stdin: INPUT})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "ctx 42%\n")
    assert.deepEqual(JSON.parse(readFileSync(join(env.state, "ctx-abc.json"), "utf8")), {used: 42, size: 200000, model: "M", effort: "high"})
    assert.equal(readFileSync(join(env.state, "usage-week"), "utf8"), "17.5 1700000000\n")
  })

  it("writes neither file when the JSON has no session or no weekly quota", async () => {
    await env.run(SCRIPT, [], {stdin: JSON.stringify({context_window: {used_percentage: 1}})})
    assert.equal(existsSync(join(env.state, "usage-week")), false)
    assert.equal(existsSync(join(env.state, "ctx-.json")), false)
  })
})
