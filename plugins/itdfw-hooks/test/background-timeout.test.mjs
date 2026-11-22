import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {spawnSync} from "node:child_process"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env
const SCRIPT = join(BIN, "background-timeout.sh")
const call = input => env.run(SCRIPT, [], {stdin: JSON.stringify({tool_name: "Bash", tool_input: input})})

beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

describe("background-timeout.sh", () => {
  it("leaves a foreground command alone", async () => {
    const r = await call({command: "sleep 1", description: "x"})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("wraps a whole background line in one capped bash, keeps the other fields, and decides no permission", async () => {
    const r = await call({command: "timeout 600 ls; until false; do sleep 3; done", description: "x", run_in_background: true})
    const out = JSON.parse(r.stdout).hookSpecificOutput
    assert.equal(out.permissionDecision, undefined)
    assert.match(out.updatedInput.command, /^timeout -k 10 600 bash -c /)
    assert.equal(out.updatedInput.description, "x")
    assert.equal(out.updatedInput.run_in_background, true)
    assert.match(out.additionalContext, /exit 124/)
  })

  it("the wrapped line runs the same commands: quotes, pipes, separators and newlines survive", async () => {
    const original = `printf '%s\\n' "a b" | tr a A; echo "it's" && echo done\necho last`
    const r = await call({command: original, run_in_background: true})
    const wrapped = JSON.parse(r.stdout).hookSpecificOutput.updatedInput.command
    const direct = spawnSync("bash", ["-c", original], {encoding: "utf8"}).stdout
    const viaCap = spawnSync("bash", ["-c", wrapped], {encoding: "utf8"}).stdout
    assert.equal(viaCap, direct)
    assert.equal(direct, "A b\nit's\ndone\nlast\n")
  })

  it("the cap cuts every part of the line, not only the first command", async () => {
    const r = await call({command: "echo start; sleep 30", run_in_background: true})
    const wrapped = JSON.parse(r.stdout).hookSpecificOutput.updatedInput.command.replace("-k 10 600", "-k 1 1")
    const t0 = Date.now()
    const p = spawnSync("bash", ["-c", wrapped], {encoding: "utf8"})
    assert.equal(p.status, 124)
    assert.equal(p.stdout, "start\n")
    assert.ok(Date.now() - t0 < 5000)
  })

  it("does not wrap a line that is already wrapped", async () => {
    const r = await call({command: "timeout -k 10 600 bash -c 'sleep 1'", run_in_background: true})
    assert.equal(r.stdout, "")
  })
})
