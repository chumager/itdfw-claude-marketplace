import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const HOOK = join(BIN, "permission-denied.sh")
const ASK = join(BIN, "permission-denied-ask.sh")
const denials = () => join(env.cache, "claude-denials", "denials.jsonl")
const undelivered = () => join(env.cache, "claude-denials", "undelivered.log")
const titleLine = () => readFileSync(`${env.log}.title`, "utf8").split("\n")[0]
const payload = (o = {}) => JSON.stringify({session_id: "sid-alpha", cwd: "/work", tool_name: "Bash", tool_input: {command: "rm -rf build"}, reason: "destructive command", ...o})

function sessionFile(name) {
  writeFileSync(join(env.claude, "sessions", "1.json"), JSON.stringify({pid: 1, name, sessionId: "sid-alpha"}))
}

// the sessions-plugin scripts, stubbed: the answer of ask-owner.sh comes from FAKE_ANSWER / FAKE_RC and its title is kept
beforeEach(() => {
  env = makeEnv()
  env.stub("owner-present.sh", "exit 0")
  env.stub("ask-owner.sh", `printf '%s' "$1" > "$FAKE_LOG.title"; echo "ask" >> "$FAKE_LOG"; [ -n "\${FAKE_SLEEP:-}" ] && sleep "$FAKE_SLEEP"; echo "ask-end" >> "$FAKE_LOG"; printf '%s' "\${FAKE_ANSWER:-}"; exit "\${FAKE_RC:-0}"`)
  env.stub("claude-session-msg.sh", `echo "msg $1|$2" >> "$FAKE_LOG"; printf '%s' "$3" > "$FAKE_LOG.msg"; exit "\${FAKE_MSG_RC:-0}"`)
})
afterEach(() => env.cleanup())

describe("permission-denied.sh", () => {
  it("records the denial in denials.jsonl, names the session, and ends without waiting for the person", async () => {
    sessionFile("alpha")
    const r = await env.run(HOOK, [], {stdin: payload({agent_type: "Explore"}), extraEnv: {FAKE_SLEEP: "1", FAKE_ANSWER: "Do not do it"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    const row = JSON.parse(readFileSync(denials(), "utf8").trim())
    assert.deepEqual(Object.keys(row), ["ts", "session_id", "agent_id", "agent_type", "cwd", "tool_name", "tool_input", "reason"])
    assert.equal(row.session_id, "sid-alpha")
    assert.equal(row.agent_type, "Explore")
    assert.deepEqual(row.tool_input, {command: "rm -rf build"})
    assert.equal(env.calls().includes("ask-end"), false, "the hook must not wait for the popup")
    assert.ok(await env.waitFor(() => env.calls().some(l => l.startsWith("msg "))), "the detached ask never delivered")
    assert.equal(titleLine(), "⛔ Explore of alpha: denied destructive command")
    assert.ok(env.calls().includes("msg alpha|hook:permissions"))
  })

  it("a session without a file is 'unnamed' and a missing agent type is 'session'", async () => {
    await env.run(HOOK, [], {stdin: payload()})
    assert.ok(await env.waitFor(() => env.calls().some(l => l.startsWith("msg "))))
    assert.equal(titleLine(), "⛔ session of unnamed: denied destructive command")
  })

  it("the command shown is cut at 160 characters; without a command the whole tool_input is shown", async () => {
    await env.run(HOOK, [], {stdin: payload({tool_input: {file_path: "/x/" + "a".repeat(300)}})})
    assert.ok(await env.waitFor(() => existsSync(`${env.log}.title`) && env.calls().includes("ask-end")))
    const title = readFileSync(`${env.log}.title`, "utf8")
    const shown = title.split("\n")[1]
    assert.equal(shown.length, 160)
    assert.match(shown, /^\{"file_path":"\/x\/a+/)
  })

  it("a payload with no reason says so", async () => {
    await env.run(HOOK, [], {stdin: payload({reason: undefined})})
    assert.ok(await env.waitFor(() => env.calls().includes("ask-end")))
    assert.equal(titleLine(), "⛔ session of unnamed: denied no reason given")
  })

  it("each denial adds one line to denials.jsonl", async () => {
    await env.run(HOOK, [], {stdin: payload()})
    await env.run(HOOK, [], {stdin: payload({tool_name: "Write"})})
    assert.equal(readFileSync(denials(), "utf8").trim().split("\n").length, 2)
    await env.waitFor(() => env.calls().filter(l => l === "ask-end").length === 2)
  })

  it("input that is not JSON: no row, no crash, exit 0", async () => {
    const r = await env.run(HOOK, [], {stdin: "not json"})
    assert.equal(r.code, 0)
    assert.equal(readFileSync(denials(), "utf8"), "")
    await env.waitFor(() => env.calls().includes("ask-end"))
  })
})

describe("permission-denied-ask.sh", () => {
  const ask = (extraEnv = {}) => env.run(ASK, ["alpha", "Bash of alpha", "destructive command", "rm -rf build"], {extraEnv})
  const sent = () => readFileSync(`${env.log}.msg`, "utf8")

  it("shows the person the denial with the two options and how to approve", async () => {
    await ask({FAKE_ANSWER: "Do not do it"})
    assert.equal(readFileSync(`${env.log}.title`, "utf8"), "⛔ Bash of alpha: denied destructive command\nrm -rf build\nTo approve it: /permissions → Recently denied → r")
  })

  it("'I approve it in /permissions': tells the session to retry in 5 minutes", async () => {
    await ask({FAKE_ANSWER: "I approve it in /permissions"})
    assert.match(sent(), /^user is going to approve the denied action in \/permissions \(destructive command\): rm -rf build\. Try again in 5 min/)
    assert.ok(env.calls().includes("msg alpha|hook:permissions"))
  })

  it("'Do not do it': tells the session to carry on without it", async () => {
    await ask({FAKE_ANSWER: "Do not do it", CLAUDE_BROADCAST_FROM: "Dana"})
    assert.match(sent(), /^Dana does NOT approve the denied action \(destructive command\): rm -rf build\. Carry on without it/)
  })

  it("free text: it is passed on as the person's answer", async () => {
    await ask({FAKE_ANSWER: "use a trash folder instead"})
    assert.equal(sent(), "About the denied action (destructive command): rm -rf build — user answered: use a trash folder instead")
  })

  it("the person was not there (exit 2): tells the session to push-notify and to ask again in 5 minutes", async () => {
    await ask({FAKE_RC: "2", FAKE_ANSWER: "no está"})
    assert.match(sent(), /^An action of yours was denied \(destructive command\): rm -rf build — and user did not answer the notice \(no está\)\. Send them a PushNotification/)
    assert.match(sent(), /CronCreate one-shot in 5 min/)
  })

  it("no answer in time (exit 3) takes the same road as not being there", async () => {
    await ask({FAKE_RC: "3", FAKE_ANSWER: "sin respuesta"})
    assert.match(sent(), /did not answer the notice \(sin respuesta\)/)
  })

  it("no live session with that name: the message goes to undelivered.log", async () => {
    mkdirSync(join(env.cache, "claude-denials"), {recursive: true})
    await ask({FAKE_ANSWER: "Do not do it", FAKE_MSG_RC: "1"})
    const line = readFileSync(undelivered(), "utf8").trim()
    assert.match(line, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d no session 'alpha' to deliver to: .*does NOT approve/)
  })

  it("a delivered message leaves no undelivered.log", async () => {
    await ask({FAKE_ANSWER: "Do not do it"})
    assert.equal(existsSync(undelivered()), false)
  })
})
