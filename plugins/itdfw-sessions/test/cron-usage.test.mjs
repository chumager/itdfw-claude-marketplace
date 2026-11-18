import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {chmodSync, mkdirSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("master-cron.sh", () => {
  const SCRIPT = join(BIN, "master-cron.sh")
  const GUARD = join(BIN, "cron-owner-guard.sh")
  let dir
  const cron = (name, body, exec = true) => {
    const f = join(dir, name)
    writeFileSync(f, `#!/usr/bin/env bash\n${body}\n`)
    if (exec) chmodSync(f, 0o755)
  }
  const run = (extraEnv = {}) => env.run(SCRIPT, [], {extraEnv: {CLAUDE_CRON_DIR: dir, ...extraEnv}})

  beforeEach(() => {
    dir = join(env.root, "crons")
    mkdirSync(dir)
  })

  it("runs every executable claude-cron-*.sh in name order, with its header and a blank line after each", async () => {
    cron("claude-cron-b.sh", "echo B")
    cron("claude-cron-a.sh", "echo A")
    const r = await run()
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "=== claude-cron-a.sh ===\nA\n\n=== claude-cron-b.sh ===\nB\n\n")
  })

  it("skips a script without the executable bit and a file that does not match the pattern", async () => {
    cron("claude-cron-a.sh", "echo A")
    cron("claude-cron-noexec.sh", "echo NOEXEC", false)
    cron("other.sh", "echo OTHER")
    cron("claude-cron-a.txt", "echo TXT")
    const r = await run()
    assert.equal(r.stdout, "=== claude-cron-a.sh ===\nA\n\n")
  })

  it("a cron that fails does not stop the next one and the exit code is still 0", async () => {
    cron("claude-cron-a.sh", "echo A; exit 3")
    cron("claude-cron-b.sh", "echo B")
    const r = await run()
    assert.equal(r.code, 0)
    assert.match(r.stdout, /A\n\n=== claude-cron-b\.sh ===\nB\n/)
  })

  it("an empty or missing directory prints nothing and exits 0", async () => {
    let r = await run()
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    r = await run({CLAUDE_CRON_DIR: join(env.root, "nope")})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("without CLAUDE_CRON_DIR it reads $HOME/bin", async () => {
    mkdirSync(join(env.home, "bin"))
    writeFileSync(join(env.home, "bin", "claude-cron-home.sh"), "echo FROM-HOME\n", {mode: 0o755})
    const r = await env.run(SCRIPT)
    assert.equal(r.stdout, "=== claude-cron-home.sh ===\nFROM-HOME\n\n")
  })

  it("with cron-owner-guard.sh: the owner session gets the work, another session is told to drop the cron", async () => {
    cron("claude-cron-work.sh", `. "${GUARD}" owner-session "work cron" || exit 0\necho "DO THE WORK"`)
    let r = await run({CRON_SESSION_NAME: "owner-session"})
    assert.match(r.stdout, /=== claude-cron-work\.sh ===\nDO THE WORK\n/)
    r = await run({CRON_SESSION_NAME: "someone-else"})
    assert.match(r.stdout, /work cron: this cron belongs to session 'owner-session' and you are 'someone-else'/)
    assert.doesNotMatch(r.stdout, /DO THE WORK/)
  })

  it("--help prints the header and runs nothing", async () => {
    cron("claude-cron-a.sh", "echo A")
    const r = await env.run(SCRIPT, ["--help"], {extraEnv: {CLAUDE_CRON_DIR: dir}})
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^master-cron\.sh: the dispatcher/)
    assert.doesNotMatch(r.stdout, /=== claude-cron-a/)
  })
})

describe("claude-usage-by-session.py", () => {
  const SCRIPT = join(BIN, "claude-usage-by-session.py")
  const run = (args = [], extraEnv = {}) => new Promise(resolve => {
    const child = spawn("python3", ["-I", SCRIPT, ...args], {env: {PATH: process.env.PATH, HOME: env.home, LANG: "C.UTF-8", ...extraEnv}, stdio: ["ignore", "pipe", "pipe"]})
    let stdout = "", stderr = ""
    child.stdout.on("data", d => { stdout += d })
    child.stderr.on("data", d => { stderr += d })
    child.on("close", code => resolve({code, stdout, stderr}))
  })
  const rec = (ts, id, model, usage, requestId = `req-${id}`) => JSON.stringify({timestamp: ts, requestId, message: {id, model, usage}})
  const transcript = (rel, records) => {
    const f = join(env.claude, "projects", "proj", rel)
    mkdirSync(join(f, ".."), {recursive: true})
    writeFileSync(f, records.join("\n") + "\n")
  }
  const SID_A = "aaaaaaaa-1111-2222"
  const SID_B = "bbbbbbbb-3333-4444"
  const rows = r => r.stdout.split("\n").filter(l => /^ *\d+\.\d%/.test(l))

  // alpha (named): opus 1M input = 5 units + a subagent's opus 1M output = 25 -> 30; sonnet 1M output = 15
  // the unnamed session: haiku 10M cache read = 0.2 * 0.5 * 10 = 1  ->  total 46
  beforeEach(() => {
    writeFileSync(join(env.sessions, "1.json"), JSON.stringify({sessionId: SID_A, name: "alpha"}))
    transcript(`${SID_A}.jsonl`, [
      rec("2026-11-16T23:00:00Z", "m1", "claude-opus-5", {input_tokens: 1_000_000}),
      rec("2026-11-16T23:00:01Z", "m1", "claude-opus-5", {input_tokens: 1_000_000}, "req-m1"),   // the same record again: counted once
      rec("2026-11-16T23:05:00Z", "m2", "claude-sonnet-5", {output_tokens: 1_000_000}),
      rec("2026-11-10T00:00:00Z", "m0", "claude-opus-5", {input_tokens: 99_000_000}),           // before the instant
      "{\"timestamp\":\"2026-11-16T23:06:00Z\",\"note\":\"a line with \\\"usage\\\" but no message\"}",
      "this line is not json but says \"usage\"",
    ])
    transcript(`${SID_A}/subagents/agent-1.jsonl`, [
      rec("2026-11-16T23:10:00Z", "m3", "claude-opus-5", {output_tokens: 1_000_000}),
    ])
    transcript(`${SID_B}.jsonl`, [
      rec("2026-11-16T23:20:00Z", "m4", "claude-haiku-5", {cache_read_input_tokens: 10_000_000}),
    ])
  })

  it("one line per session and family sorted by cost, with the shares; a subagent counts for its parent", async () => {
    const r = await run(["2026-11-16T22:00:00"])
    assert.equal(r.code, 0)
    const l = rows(r)
    assert.equal(l.length, 3)
    assert.match(l[0], /^ 65\.2%  alpha +opus +turns= +2 out= +1\.00M cacheR= +0\.0M cacheW= +0\.0M in= +1\.00M$/)
    assert.match(l[1], /^ 32\.6%  alpha +sonnet +turns= +1 out= +1\.00M/)
    assert.match(l[2], /^  2\.2%  bbbbbbbb +haiku +turns= +1 .*cacheR= +10\.0M/)
    assert.match(r.stdout, /\{'opus': '65%', 'sonnet': '33%', 'haiku': '2%'\}\n$/)
  })

  it("the instant filters: a later one leaves out the older records", async () => {
    const r = await run(["2026-11-16T23:15:00"])
    assert.equal(rows(r).length, 1)
    assert.match(rows(r)[0], /^100\.0%  bbbbbbbb +haiku/)
  })

  it("the default instant is CLAUDE_USAGE_SINCE and then 2026-11-15T15:00:00", async () => {
    transcript(`${SID_B}.jsonl`, [
      rec("2026-11-15T14:59:00Z", "n1", "claude-haiku-5", {input_tokens: 1_000_000}),
      rec("2026-11-15T15:01:00Z", "n2", "claude-haiku-5", {input_tokens: 1_000_000}),
    ])
    let r = await run([], {CLAUDE_USAGE_SINCE: "2026-11-17T00:00:00"})
    assert.equal(r.stdout, "{}\n")
    r = await run([], {CLAUDE_USAGE_SINCE: "2026-11-15T00:00:00"})
    assert.match(rows(r).find(l => l.includes("bbbbbbbb")), /turns= +2 /)
    r = await run()
    assert.match(rows(r).find(l => l.includes("bbbbbbbb")), /turns= +1 /)
  })

  it("nothing since the instant: an empty dict and exit 0, as the original", async () => {
    const r = await run(["2030-01-01T00:00:00"])
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "{}\n")
    assert.equal(r.stderr, "")
  })

  it("records that carry no tokens at all do not divide by zero (the original crashed)", async () => {
    transcript(`${SID_B}.jsonl`, [rec("2026-11-16T23:20:00Z", "z1", "claude-haiku-5", {input_tokens: 0})])
    const r = await run(["2026-11-16T23:19:00"])
    assert.equal(r.code, 0)
    assert.match(rows(r)[0], /^  0\.0%  bbbbbbbb +haiku +turns= +1 /)
  })

  it("CLAUDE_CONFIG_DIR moves the claude home; a home with no transcripts gives an empty dict", async () => {
    const empty = join(env.root, "empty-home")
    mkdirSync(empty)
    const r = await run(["2026-11-16T22:00:00"], {CLAUDE_CONFIG_DIR: empty})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "{}\n")
  })

  it("only the 22 most expensive rows are printed", async () => {
    for (let i = 0; i < 25; i++) transcript(`s${String(i).padStart(2, "0")}xxxxx-0000.jsonl`, [rec("2026-11-16T23:30:00Z", `x${i}`, "claude-haiku-5", {input_tokens: 1_000 + i})])
    const r = await run(["2026-11-16T22:00:00"])
    assert.equal(rows(r).length, 22)
  })
})
