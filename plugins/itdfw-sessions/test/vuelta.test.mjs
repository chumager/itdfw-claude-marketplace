import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

const V = join(BIN, "vuelta.sh")
let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

/** Runs the ledger and returns its trimmed stdout. */
const v = async (...args) => (await env.run(V, args)).stdout.trim()
const events = () => readFileSync(join(env.state, "vuelta", "log.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l).event)

describe("vuelta.sh: who owes an answer to whom", () => {
  it("a request opens one debt and the reminder names the asker", async () => {
    assert.equal(await v("receive", "Y", "X"), "request")
    assert.equal(await v("pending", "Y"), "X")
  })

  it("the answer closes the debt and, reaching the asker, opens no opposite debt (no ping-pong)", async () => {
    await v("receive", "Y", "X")
    await v("sent", "Y", "X")
    assert.equal(await v("pending", "Y"), "")
    assert.equal(await v("receive", "X", "Y"), "reply")
    assert.equal(await v("pending", "X"), "")
    assert.deepEqual(events(), ["opened", "answered"])
  })

  it("after the round is closed, a new message from the same session is a new request", async () => {
    await v("receive", "Y", "X"); await v("sent", "Y", "X"); await v("receive", "X", "Y")
    assert.equal(await v("receive", "X", "Y"), "request")
  })

  it("an answer whose sending was not seen is still closed when it reaches the asker", async () => {
    await v("receive", "Y", "X")
    assert.equal(await v("receive", "X", "Y"), "reply")
    assert.equal(await v("pending", "Y"), "")
  })

  it("an 'answered' mark older than its TTL does not turn a later request into a reply", async () => {
    await v("receive", "Y", "X"); await v("sent", "Y", "X")
    writeFileSync(join(env.state, "vuelta", "answered", "X", "Y"), `${Math.floor(Date.now() / 1000) - 600}\n`)
    assert.equal(await v("receive", "X", "Y"), "request")
  })

  it("two askers at once are tracked apart, and a recipient written with its [ref] closes its own", async () => {
    await v("receive", "Y", "A"); await v("receive", "Y", "B")
    await v("sent", "Y", "A")
    assert.equal(await v("pending", "Y"), "B")
    await v("sent", "Y", "B [3fa9c1]")
    assert.equal(await v("pending", "Y"), "")
  })

  it("a recipient given as a socket address is resolved to its session name", async () => {
    const s = await env.session({name: "core"})
    const sock = JSON.parse(readFileSync(join(env.sessions, `${s.pid}.json`), "utf8")).messagingSocketPath
    await v("receive", "Y", "core")
    await v("sent", "Y", `uds:${sock}`)
    assert.equal(await v("pending", "Y"), "")
  })

  it("a second message from the same asker does not open a second debt", async () => {
    await v("receive", "Y", "X"); await v("receive", "Y", "X")
    assert.equal(await v("pending", "Y"), "X")
    assert.deepEqual(events(), ["opened"])
  })

  it("a debt that cannot be paid is given up after VUELTA_MAX reminders and recorded as failed", async () => {
    await v("receive", "Y", "X")
    for (let i = 0; i < 3; i++) assert.equal(await v("pending", "Y"), "X")
    assert.equal(await v("pending", "Y"), "")
    assert.deepEqual(events(), ["opened", "failed"])
  })

  it("a session name with a space or a slash is a valid name", async () => {
    await v("receive", "cierre diario", "a/b")
    assert.equal(await v("pending", "cierre diario"), "a_b")
  })

  it("name: the session name of a Claude process, empty for a pid without session file", async () => {
    const s = await env.session({name: "QA"})
    assert.equal(await v("name", String(s.pid)), "QA")
    assert.equal(await v("name", "999999"), "")
  })

  it("list shows every open debt", async () => {
    await v("receive", "Y", "X")
    assert.match(await v("list"), /^Y owes X since \d\d:\d\d \(0\)$/)
  })

  it("bad usage exits 2", async () => {
    assert.equal((await env.run(V, ["receive", "Y"])).code, 2)
    assert.equal((await env.run(V, ["nope"])).code, 2)
  })
})
