import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, mkdirSync, readFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "stopfailure-log.sh")
const logFile = () => join(env.claude, "stopfailure.log")
const payload = {session_id: "sid-1", cwd: "/work", error: "rate_limit", error_details: "429 Too Many Requests", last_assistant_message: "partial answer", extra: "dropped"}

beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("stopfailure-log.sh", () => {
  it("appends one JSON line with the time and the six fields, and exits 0", async () => {
    const r = await env.run(SCRIPT, [], {stdin: JSON.stringify(payload)})
    assert.equal(r.code, 0)
    const row = JSON.parse(readFileSync(logFile(), "utf8").trim())
    assert.deepEqual(Object.keys(row), ["at", "session_id", "cwd", "error", "error_details", "last_assistant_message"])
    assert.match(row.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/)
    assert.equal(row.error, "rate_limit")
    assert.equal(row.last_assistant_message, "partial answer")
  })

  it("a second failure adds a second line", async () => {
    await env.run(SCRIPT, [], {stdin: JSON.stringify(payload)})
    await env.run(SCRIPT, [], {stdin: JSON.stringify({...payload, session_id: "sid-2"})})
    const lines = readFileSync(logFile(), "utf8").trim().split("\n")
    assert.equal(lines.length, 2)
    assert.equal(JSON.parse(lines[1]).session_id, "sid-2")
  })

  it("a field the payload lacks is null", async () => {
    await env.run(SCRIPT, [], {stdin: JSON.stringify({session_id: "sid-3"})})
    const row = JSON.parse(readFileSync(logFile(), "utf8").trim())
    assert.equal(row.error, null)
    assert.equal(row.cwd, null)
  })

  it("CLAUDE_CONFIG_DIR moves the log", async () => {
    const dir = join(env.root, "cfg")
    mkdirSync(dir)
    await env.run(SCRIPT, [], {stdin: JSON.stringify(payload), extraEnv: {CLAUDE_CONFIG_DIR: dir}})
    assert.ok(existsSync(join(dir, "stopfailure.log")))
    assert.equal(existsSync(logFile()), false)
  })

  it("input that is not JSON: jq's exit code (5) and no line in the log", async () => {
    const r = await env.run(SCRIPT, [], {stdin: "not json"})
    assert.equal(r.code, 5)
    assert.equal(readFileSync(logFile(), "utf8"), "")
  })

  it("a config directory that does not exist: exit 2 and nothing created", async () => {
    const r = await env.run(SCRIPT, [], {stdin: JSON.stringify(payload), extraEnv: {CLAUDE_CONFIG_DIR: join(env.root, "missing")}})
    assert.equal(r.code, 2)
    assert.equal(existsSync(join(env.root, "missing")), false)
  })
})
