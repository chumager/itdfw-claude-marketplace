import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, mkdirSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, SESSIONS_BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "away-notice.sh")
const post = sid => JSON.stringify({hook_event_name: "PostToolUse", session_id: sid})
const stop = sid => JSON.stringify({hook_event_name: "Stop", session_id: sid})
const mark = sid => join(env.cache, "claude-away", sid)
// no client attached unless FAKE_CLIENTS is set
const TMUX = `[ "$1" = list-clients ] && [ -n "\${FAKE_CLIENTS:-}" ] && echo "$FAKE_CLIENTS"; exit 0`

beforeEach(() => {
  env = makeEnv()
  env.stub("tmux", TMUX)
})
afterEach(() => env.cleanup())

describe("away-notice.sh (the real owner-present.sh of the sessions plugin, found next to this plugin)", () => {
  it("PostToolUse with no tmux client: prints the additionalContext JSON once and leaves a mark", async () => {
    const r = await env.run(SCRIPT, [], {stdin: post("s1")})
    assert.equal(r.code, 0)
    const out = JSON.parse(r.stdout)
    assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse")
    assert.match(out.hookSpecificOutput.additionalContext, /^user is not at the laptop \(no tmux client\)\. .*PushNotification/)
    assert.ok(existsSync(mark("s1")))
  })

  it("the second tool of the same turn says nothing", async () => {
    await env.run(SCRIPT, [], {stdin: post("s1")})
    const r = await env.run(SCRIPT, [], {stdin: post("s1")})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("Stop removes the mark and prints nothing, so the next turn is told again", async () => {
    await env.run(SCRIPT, [], {stdin: post("s1")})
    const r = await env.run(SCRIPT, [], {stdin: stop("s1")})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    assert.equal(existsSync(mark("s1")), false)
    const again = await env.run(SCRIPT, [], {stdin: post("s1")})
    assert.notEqual(again.stdout, "")
  })

  it("a tmux client attached: silent, and a stale mark is removed", async () => {
    mkdirSync(join(env.cache, "claude-away"))
    writeFileSync(mark("s1"), "")
    const r = await env.run(SCRIPT, [], {stdin: post("s1"), extraEnv: {FAKE_CLIENTS: "client-1"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    assert.equal(existsSync(mark("s1")), false)
  })

  it("each session has its own mark", async () => {
    await env.run(SCRIPT, [], {stdin: post("s1")})
    const r = await env.run(SCRIPT, [], {stdin: post("s2")})
    assert.notEqual(r.stdout, "")
    assert.ok(existsSync(mark("s2")))
  })

  it("a payload with no session id uses the mark 'unknown'", async () => {
    await env.run(SCRIPT, [], {stdin: JSON.stringify({hook_event_name: "PostToolUse"})})
    assert.ok(existsSync(mark("unknown")))
  })

  it("the person's name comes from CLAUDE_BROADCAST_FROM", async () => {
    const r = await env.run(SCRIPT, [], {stdin: post("s1"), extraEnv: {CLAUDE_BROADCAST_FROM: "Dana"}})
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /^Dana is not at the laptop/)
  })

  it("the name also comes from the sessions plugin's config file", async () => {
    const dir = join(env.home, ".config", "claude-sessions")
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, "env"), "CLAUDE_BROADCAST_FROM=Erin\n")
    const r = await env.run(SCRIPT, [], {stdin: post("s1")})
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /^Erin is not at the laptop/)
  })

  it("a name with quotes still gives valid JSON", async () => {
    const r = await env.run(SCRIPT, [], {stdin: post("s1"), extraEnv: {CLAUDE_BROADCAST_FROM: 'A "quoted" name'}})
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /^A "quoted" name is not at the laptop/)
  })
})

describe("away-notice.sh finds owner-present.sh", () => {
  it("through ITDFW_SESSIONS_BIN first", async () => {
    const dir = join(env.root, "other-bin")
    mkdirSync(dir)
    env.stub("owner-present.sh", `echo "override" >> "$FAKE_LOG"; exit 0`, dir)
    const r = await env.run(SCRIPT, [], {stdin: post("s1"), extraEnv: {ITDFW_SESSIONS_BIN: dir}})
    assert.equal(r.stdout, "")
    assert.deepEqual(env.calls(), ["override"])
  })

  it("through the PATH when the plugin is not next to it", async () => {
    env.stub("owner-present.sh", `echo "from-path" >> "$FAKE_LOG"; exit 1`)
    const r = await env.run(SCRIPT, [], {stdin: post("s1")})
    assert.notEqual(r.stdout, "")
    assert.deepEqual(env.calls(), ["from-path"])
  })

  it("through the sibling plugin of a checkout (the fixture above runs this case; the path is the real one)", () => {
    assert.ok(existsSync(join(SESSIONS_BIN, "owner-present.sh")))
  })
})
