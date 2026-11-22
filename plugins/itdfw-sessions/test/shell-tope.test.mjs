import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, readFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "cajaritos-shell-tope.sh")
// ps prints the rows in FAKE_PS; kill is logged and never signals anything real.
const stubs = rows => {
  env.stub("ps", `printf '%s\\n' ${rows.map(r => JSON.stringify(r)).join(" ")}`)
  env.stub("kill", `echo "kill $*" >> "$FAKE_LOG"`)
  env.stub("sleep", "true")
}
const shell = (pid, secs, cmd) => `${pid} ${pid} ${secs} /bin/bash -c source ${env.claude}/shell-snapshots/snapshot-bash-1.sh 2>/dev/null || true && eval '${cmd}'`

beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("cajaritos-shell-tope.sh", () => {
  it("ends the process group of a tool shell past the cap, TERM then KILL, and logs it", async () => {
    stubs([shell(101, 900, "until false; do sleep 3; done"), shell(102, 30, "pnpm test")])
    const r = await env.run(SCRIPT, [], {extraEnv: {CLAUDE_STATE_DIR: env.state}})
    assert.equal(r.code, 0)
    assert.deepEqual(env.calls(), ["kill -TERM -- -101", "kill -KILL -- -101"])
    const log = readFileSync(join(env.state, "shell-tope.log"), "utf8")
    assert.match(log, /pgid=101 900s .*until false/)
    assert.doesNotMatch(log, /pgid=102/)
  })

  it("leaves alone what is not a tool shell, or not a group leader, even if old", async () => {
    stubs([
      "201 201 90000 node /usr/lib/node_modules/some-mcp/server.js",
      `202 101 90000 /bin/bash -c source ${env.claude}/shell-snapshots/x.sh && eval 'child'`,
      "203 203 90000 /bin/bash -c source /elsewhere/shell-snapshots/x.sh",
    ])
    const r = await env.run(SCRIPT, [], {extraEnv: {CLAUDE_STATE_DIR: env.state}})
    assert.equal(r.code, 0)
    assert.deepEqual(env.calls(), [])
    assert.equal(existsSync(join(env.state, "shell-tope.log")), false)
  })

  it("--seco says what it would end and ends nothing; --tope moves the cap", async () => {
    stubs([shell(301, 120, "sleep 999")])
    const r = await env.run(SCRIPT, ["--seco", "--tope", "60"], {extraEnv: {CLAUDE_STATE_DIR: env.state}})
    assert.match(r.stdout, /^would end: .*pgid=301 120s/)
    assert.deepEqual(env.calls(), [])
  })

  it("bad usage exits 2", async () => {
    stubs([])
    const r = await env.run(SCRIPT, ["--tope", "diez"], {extraEnv: {CLAUDE_STATE_DIR: env.state}})
    assert.equal(r.code, 2)
  })
})
