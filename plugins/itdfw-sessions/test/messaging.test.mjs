import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync, utimesSync, mkdirSync} from "node:fs"
import {join} from "node:path"
import {BIN, EXAMPLES, makeEnv, messageOf, parseReceived} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("claude-session-msg.sh", () => {
  const SCRIPT = join(BIN, "claude-session-msg.sh")

  it("delivers auth + user message to the session with that exact name; exit 0", async () => {
    const a = await env.session({name: "alpha"})
    const b = await env.session({name: "alpha-2"})
    const r = await env.run(SCRIPT, ["alpha", "hello there"])
    assert.equal(r.code, 0)
    const [auth, user] = parseReceived(a)
    assert.deepEqual(auth, {type: "auth", token: "tok-alpha"})
    assert.equal(user.message.role, "user")
    assert.match(user.message.content, /^<cross-session-message from="cron:cron" from-name="cron" from-mode="prompting">\nhello there\n<\/cross-session-message>$/)
    assert.equal(b.received.length, 0)
  })

  it("uses the third argument as from-name", async () => {
    const a = await env.session({name: "alpha"})
    await env.run(SCRIPT, ["alpha", "x", "nightly"])
    assert.match(messageOf(a), /from="cron:nightly" from-name="nightly"/)
  })

  it("JSON-escapes quotes and newlines in the text", async () => {
    const a = await env.session({name: "alpha"})
    await env.run(SCRIPT, ["alpha", 'say "hi"\nsecond line'])
    assert.ok(messageOf(a).includes('say "hi"\nsecond line'))
  })

  it("exit 1: no session with that name", async () => {
    await env.session({name: "alpha"})
    assert.equal((await env.run(SCRIPT, ["nobody", "x"])).code, 1)
  })

  it("exit 1 and nothing delivered: spare, dead pid, no socket, no key file", async () => {
    const cases = [{spare: true}, {alive: false}, {socket: false}, {key: false}]
    for (const c of cases) {
      const e = makeEnv()
      try {
        const s = await e.session({name: "alpha", ...c})
        const r = await e.run(SCRIPT, ["alpha", "x"])
        assert.equal(r.code, 1, JSON.stringify(c))
        assert.equal(s.received.length, 0, JSON.stringify(c))
      } finally { e.cleanup() }
    }
  })

  it("falls through to a second live session with the same name when the first is dead", async () => {
    await env.session({name: "alpha", alive: false})
    const live = await env.session({name: "alpha"})
    assert.equal((await env.run(SCRIPT, ["alpha", "x"])).code, 0)
    assert.equal(live.received.length, 2)
  })

  it("reads the sessions dir from CLAUDE_CONFIG_DIR", async () => {
    const other = makeEnv()
    try {
      const s = await other.session({name: "alpha"})
      const r = await env.run(SCRIPT, ["alpha", "x"], {extraEnv: {CLAUDE_CONFIG_DIR: other.claude}})
      assert.equal(r.code, 0)
      assert.equal(s.received.length, 2)
    } finally { other.cleanup() }
  })

  it("reads the text from stdin when there is no second argument", async () => {
    const a = await env.session({name: "alpha"})
    assert.equal((await env.run(SCRIPT, ["alpha"], {stdin: "from stdin"})).code, 0)
    assert.ok(messageOf(a).includes("\nfrom stdin\n"))
  })

  it("'-' reads stdin and still takes the third argument as from-name", async () => {
    const a = await env.session({name: "alpha"})
    await env.run(SCRIPT, ["alpha", "-", "hilo"], {stdin: "x"})
    assert.match(messageOf(a), /from="cron:hilo"[^]*\nx\n/)
  })

  it("delivers a 200 KB text from stdin intact (over the kernel's 128 KB limit for one argument)", async () => {
    const a = await env.session({name: "alpha"})
    const big = "START\n" + "abcdefghij".repeat(20000) + "\nEND"
    assert.equal((await env.run(SCRIPT, ["alpha"], {stdin: big})).code, 0)
    assert.ok(messageOf(a).includes(big))
  })

  it("exit 2 and a usage line on stderr when the text is missing", async () => {
    const r = await env.run(SCRIPT, ["alpha"])
    assert.equal(r.code, 2)
    assert.match(r.stderr, /^usage: claude-session-msg\.sh/)
  })
})

describe("claude-broadcast.sh", () => {
  const SCRIPT = join(BIN, "claude-broadcast.sh")

  it("reaches every live non-spare session, prints 'ok <name>' each, exit 0; from defaults to 'user'", async () => {
    const a = await env.session({name: "alpha"})
    const b = await env.session({name: "beta"})
    const spare = await env.session({name: "spare", spare: true})
    const dead = await env.session({name: "dead", alive: false})
    const r = await env.run(SCRIPT, ["wake up"])
    assert.equal(r.code, 0)
    assert.deepEqual(r.stdout.split("\n").filter(Boolean).sort(), ["ok alpha", "ok beta"])
    for (const s of [a, b]) assert.match(messageOf(s), /from="cron:user" from-name="user"[^>]*>\nwake up\n/)
    assert.equal(spare.received.length + dead.received.length, 0)
  })

  it("skips the session that launches it (an ancestor of the script) and says nothing about it", async () => {
    const me = await env.session({name: "me", pid: process.pid})
    const other = await env.session({name: "other"})
    const r = await env.run(SCRIPT, ["x"])
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), "ok other")
    assert.equal(me.received.length, 0)
    assert.equal(other.received.length, 2)
  })

  it("prints 'failed <name>' and exits 1 when a session cannot be reached", async () => {
    await env.session({name: "alpha"})
    await env.session({name: "nokey", key: false})
    const r = await env.run(SCRIPT, ["x"])
    assert.equal(r.code, 1)
    assert.deepEqual(r.stdout.split("\n").filter(Boolean).sort(), ["failed nokey", "ok alpha"])
  })

  it("sender: second argument wins over CLAUDE_BROADCAST_FROM, which wins over the default", async () => {
    const a = await env.session({name: "alpha"})
    await env.run(SCRIPT, ["x"], {extraEnv: {CLAUDE_BROADCAST_FROM: "boss"}})
    await env.run(SCRIPT, ["y", "ops"], {extraEnv: {CLAUDE_BROADCAST_FROM: "boss"}})
    const froms = parseReceived(a).filter(l => l.type === "user").map(l => l.message.content.match(/from-name="([^"]+)"/)[1])
    assert.deepEqual(froms, ["boss", "ops"])
  })

  it("exit 2 with a usage line when the text is missing", async () => {
    const r = await env.run(SCRIPT, [])
    assert.equal(r.code, 2)
    assert.match(r.stderr, /^usage: claude-broadcast\.sh/)
  })

  it("an option-looking first word (-x, --verbose) is refused with exit 2 and reaches nobody", async () => {
    const a = await env.session({name: "alpha"})
    for (const flag of ["-x", "--verbose", "--dry-run"]) {
      const r = await env.run(SCRIPT, [flag])
      assert.equal(r.code, 2, flag)
      assert.match(r.stderr, /^unknown option: /, flag)
    }
    assert.equal(a.received.length, 0)
    const ok = await env.run(SCRIPT, ["-- not an option, a sentence"])
    assert.equal(ok.code, 0)
  })
})

describe("claude-keepalive.sh", () => {
  const SCRIPT = join(BIN, "claude-keepalive.sh")

  it("pings every live non-spare session as from-name=keepalive and exits 0", async () => {
    const a = await env.session({name: "alpha"})
    const b = await env.session({name: "beta"})
    const spare = await env.session({name: "spare", spare: true})
    const dead = await env.session({name: "dead", alive: false})
    const nokey = await env.session({name: "nokey", key: false})
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 0)
    for (const s of [a, b]) {
      assert.deepEqual(parseReceived(s)[0], {type: "auth", token: `tok-${s.name}`})
      assert.match(messageOf(s), /from="cron:keepalive" from-name="keepalive" from-mode="prompting">\n.*answer only pong/)
    }
    assert.equal(spare.received.length + dead.received.length + nokey.received.length, 0)
  })

  it("does nothing, exit 0, with no sessions", async () => {
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 0)
    assert.equal(r.stdout + r.stderr, "")
  })
})

describe("claude-session-name.sh", () => {
  const SCRIPT = join(BIN, "claude-session-name.sh")

  it("prints the name of the session file of an ancestor process; exit 0", async () => {
    await env.session({name: "my-session", pid: process.pid})
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "my-session\n")
  })

  it("exit 1 and nothing printed when no ancestor has a named session file", async () => {
    await env.session({name: "elsewhere"})
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 1)
    assert.equal(r.stdout, "")
  })
})

describe("cron-owner-guard.sh (sourced)", () => {
  const GUARD = join(BIN, "cron-owner-guard.sh")
  const source = (owner, extraEnv) => env.run("-c", [`. "${GUARD}" ${owner} CRON_X || { echo "rc=$?"; exit 7; }; echo owner-ok`], {extraEnv})

  it("returns 0 silently for the owner session (name from CRON_SESSION_NAME)", async () => {
    const r = await source("boss", {CRON_SESSION_NAME: "boss"})
    assert.equal(r.stdout, "owner-ok\n")
  })

  it("returns 1 for another session, with the do-nothing order and the CronDelete instruction", async () => {
    const r = await source("boss", {CRON_SESSION_NAME: "intern"})
    assert.equal(r.code, 7)
    assert.match(r.stdout, /^CRON_X: this cron belongs to session 'boss' and you are 'intern'\. Do nothing for this\ncron \(no workflow, no CronCreate\)\. If you have a cron that calls this script, delete it with CronDelete\.\nrc=1\n$/)
  })

  it("resolves the name from the session file of CLAUDE_PID", async () => {
    const s = await env.session({name: "boss"})
    const r = await source("boss", {CLAUDE_PID: String(s.pid)})
    assert.equal(r.stdout, "owner-ok\n")
  })

  it("says 'no name' when the session cannot be resolved", async () => {
    const r = await source("boss", {})
    assert.match(r.stdout, /you are 'no name'/)
  })
})

describe("examples/daily-close-cron.sh", () => {
  const SCRIPT = join(EXAMPLES, "daily-close-cron.sh")
  const day = new Date().toISOString().slice(0, 10)
  const markDir = () => join(env.root, "marks")
  const run = (...args) => env.run(SCRIPT, args, {extraEnv: {CLOSE_MARK_DIR: markDir()}})
  const mark = (suffix, ageHours = 0) => {
    mkdirSync(markDir(), {recursive: true})
    const f = join(markDir(), `${day}.${suffix}`)
    writeFileSync(f, "")
    const t = new Date(Date.now() - ageHours * 3600e3)
    utimesSync(f, t, t)
  }

  it("sends the message to the owner session with the day marks in it", async () => {
    const owner = await env.session({name: "closer"})
    const r = await run("closer")
    assert.equal(r.code, 0)
    assert.match(messageOf(owner), new RegExp(`from="cron:daily-close".*Daily close of ${day}`, "s"))
    assert.ok(messageOf(owner).includes(`${markDir()}/${day}.running`))
  })

  it("sends nothing when today's .done exists, or a fresh .running exists", async () => {
    const owner = await env.session({name: "closer"})
    mark("done")
    assert.equal((await run("closer")).code, 0)
    env.cleanup(); env = makeEnv()
    const owner2 = await env.session({name: "closer"})
    mark("running", 1)
    assert.equal((await run("closer")).code, 0)
    assert.equal(owner.received.length + owner2.received.length, 0)
  })

  it("retries when the .running is older than 3 h", async () => {
    const owner = await env.session({name: "closer"})
    mark("running", 4)
    assert.equal((await run("closer")).code, 0)
    assert.equal(owner.received.length, 2)
  })

  it("falls back to the second session with a note when the owner is not alive", async () => {
    const fb = await env.session({name: "backup"})
    const r = await run("closer", "backup")
    assert.equal(r.code, 0)
    assert.match(messageOf(fb), /The session 'closer' is not alive\. Daily close of/)
  })

  it("exit 1 and a message on stderr when nobody is alive", async () => {
    const r = await run("closer", "backup")
    assert.equal(r.code, 1)
    assert.match(r.stderr, /no live session to receive it \(closer, backup\)/)
  })
})
