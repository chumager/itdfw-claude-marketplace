import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {mkdirSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "prompt-context.sh")
const PRECOMPACT = join(BIN, "precompact.sh")
const payload = sid => JSON.stringify({hook_event_name: "UserPromptSubmit", session_id: sid, prompt: "hello"})
// no tmux client attached unless FAKE_CLIENTS is set (the real owner-present.sh of the sessions plugin runs on top of this)
const TMUX = `[ "$1" = list-clients ] && [ -n "\${FAKE_CLIENTS:-}" ] && echo "$FAKE_CLIENTS"; exit 0`
const ctx = (sid, body) => {
  mkdirSync(join(env.claude, "state"), {recursive: true})
  writeFileSync(join(env.claude, "state", `ctx-${sid}.json`), typeof body === "string" ? body : JSON.stringify(body))
}
const lines = r => r.stdout.split("\n").filter(Boolean)

beforeEach(() => {
  env = makeEnv()
  env.stub("tmux", TMUX)
})
afterEach(() => env.cleanup())

describe("prompt-context.sh: the four lines", () => {
  it("person present, session with a ctx file: date, hint, [PRESENCIA], [CONTEXTO], [MODELO], in that order", async () => {
    ctx("s1", {used: 40, model: "sonnet", effort: "high"})
    const r = await env.run(SCRIPT, [], {stdin: payload("s1"), extraEnv: {FAKE_CLIENTS: "client-1"}})
    assert.equal(r.code, 0)
    const l = lines(r)
    assert.equal(l.length, 5)
    assert.match(l[0], /^[A-Z][a-z]{2} [A-Z][a-z]{2} +\d+ \d\d:\d\d:\d\d UTC \d{4}$/)
    assert.match(l[1], /^\[HINT FECHA\/HORA\] .*REAL date\/time/)
    assert.equal(l[2], "[PRESENCIA] user is at the laptop.")
    assert.equal(l[3], "[CONTEXTO] 40%")
    assert.equal(l[4], "[MODELO] sonnet · high")
  })

  it("person absent: [PRESENCIA] says so and points at push and ask-owner.sh", async () => {
    const r = await env.run(SCRIPT, [], {stdin: payload("s1")})
    assert.equal(r.code, 0)
    const presence = lines(r).find(x => x.startsWith("[PRESENCIA]"))
    assert.match(presence, /^\[PRESENCIA\] user is NOT at the laptop .*PushNotification.*ask-owner\.sh/)
  })

  it("the person's name comes from CLAUDE_BROADCAST_FROM, and from the sessions config file", async () => {
    let r = await env.run(SCRIPT, [], {stdin: payload("s1"), extraEnv: {CLAUDE_BROADCAST_FROM: "Dana"}})
    assert.match(r.stdout, /\[PRESENCIA\] Dana is NOT at the laptop/)
    const dir = join(env.home, ".config", "claude-sessions")
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, "env"), "CLAUDE_BROADCAST_FROM=Erin\n")
    r = await env.run(SCRIPT, [], {stdin: payload("s1"), extraEnv: {FAKE_CLIENTS: "c"}})
    assert.match(r.stdout, /\[PRESENCIA\] Erin is at the laptop\./)
  })

  it("no personal data in the output: no home path, no machine name", async () => {
    ctx("s1", {used: 95, model: "m", effort: "e"})
    const r = await env.run(SCRIPT, [], {stdin: payload("s1")})
    assert.doesNotMatch(r.stdout, /\/home\/|jcmunoz|~\/bin/)
  })
})

describe("prompt-context.sh: [CONTEXTO] thresholds", () => {
  const ctxLine = async used => {
    ctx("s1", {used})
    const r = await env.run(SCRIPT, [], {stdin: payload("s1")})
    return lines(r).find(x => x.startsWith("[CONTEXTO]"))
  }

  it("below 75: only the percent", async () => assert.equal(await ctxLine(74), "[CONTEXTO] 74%"))
  it("75 to 89: the fork is blocked, delegate", async () => {
    assert.match(await ctxLine(75), /^\[CONTEXTO\] 75% — a fork is blocked: delegate with a fresh subagent/)
    assert.match(await ctxLine(89), /^\[CONTEXTO\] 89% — a fork is blocked/)
  })
  it("90 and over: about to compact, write the state down", async () => {
    assert.match(await ctxLine(90), /^\[CONTEXTO\] 90% — about to compact: leave written down/)
    assert.match(await ctxLine(100), /^\[CONTEXTO\] 100% — about to compact/)
  })
})

describe("prompt-context.sh: [MODELO] and the missing pieces", () => {
  it("the model without an effort prints the model alone", async () => {
    ctx("s1", {used: 10, model: "opus"})
    const r = await env.run(SCRIPT, [], {stdin: payload("s1")})
    assert.ok(lines(r).includes("[MODELO] opus"))
  })

  it("a session with no ctx file gets only the date, the hint and the presence, and exit 0", async () => {
    const r = await env.run(SCRIPT, [], {stdin: payload("never-seen")})
    assert.equal(r.code, 0)
    assert.equal(lines(r).length, 3)
    assert.doesNotMatch(r.stdout, /\[CONTEXTO\]|\[MODELO\]/)
  })

  it("empty stdin and a payload that is not JSON: exit 0, no ctx lines", async () => {
    for (const stdin of ["", "not json"]) {
      const r = await env.run(SCRIPT, [], {stdin})
      assert.equal(r.code, 0)
      assert.equal(lines(r).length, 3)
    }
  })

  it("a ctx file that is not JSON: exit 0, no ctx lines", async () => {
    ctx("s1", "{broken")
    const r = await env.run(SCRIPT, [], {stdin: payload("s1")})
    assert.equal(r.code, 0)
    assert.doesNotMatch(r.stdout, /\[CONTEXTO\]|\[MODELO\]/)
  })

  it("each session reads its own file", async () => {
    ctx("a", {used: 11, model: "ma"})
    ctx("b", {used: 22, model: "mb"})
    const r = await env.run(SCRIPT, [], {stdin: payload("b")})
    assert.ok(lines(r).includes("[CONTEXTO] 22%"))
    assert.ok(lines(r).includes("[MODELO] mb"))
  })

  it("CLAUDE_STATE_DIR moves the state dir", async () => {
    const dir = join(env.root, "elsewhere")
    mkdirSync(dir)
    writeFileSync(join(dir, "ctx-s1.json"), JSON.stringify({used: 33}))
    const r = await env.run(SCRIPT, [], {stdin: payload("s1"), extraEnv: {CLAUDE_STATE_DIR: dir}})
    assert.ok(lines(r).includes("[CONTEXTO] 33%"))
  })

  it("--help prints the header and nothing else", async () => {
    const r = await env.run(SCRIPT, ["--help"])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^prompt-context\.sh: UserPromptSubmit hook/)
    assert.doesNotMatch(r.stdout, /\[HINT FECHA/)
  })
})

describe("precompact.sh", () => {
  it("prints the directive to the compactor and exits 0, whatever arrives on stdin", async () => {
    const r = await env.run(PRECOMPACT, [], {stdin: "{\"hook_event_name\":\"PreCompact\"}"})
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^=== COMPACTOR DIRECTIVE ===/)
    assert.match(r.stdout, /COMPACTION PRIORITY/)
    assert.match(r.stdout, /Do NOT spend tokens summarizing what is discardable/)
    assert.equal(r.stderr, "")
  })

  it("the person is 'user' by default and CLAUDE_BROADCAST_FROM otherwise; nothing personal is left in", async () => {
    let r = await env.run(PRECOMPACT)
    assert.match(r.stdout, /personal matters of user\./)
    assert.match(r.stdout, /- user's own words/)
    r = await env.run(PRECOMPACT, [], {extraEnv: {CLAUDE_BROADCAST_FROM: "Dana"}})
    assert.match(r.stdout, /personal matters of Dana\./)
    assert.match(r.stdout, /- Dana's own words/)
    assert.doesNotMatch(r.stdout, /jcmunoz|claude-docs|\/home\//)
  })

  it("--help prints the header and no directive", async () => {
    const r = await env.run(PRECOMPACT, ["--help"])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^precompact\.sh: PreCompact hook/)
    assert.doesNotMatch(r.stdout, /COMPACTOR DIRECTIVE/)
  })
})
