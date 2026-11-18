import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {spawnSync} from "node:child_process"
import {readdirSync, readFileSync, statSync} from "node:fs"
import {join} from "node:path"
import {BIN, EXAMPLES, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const scripts = [
  // `_env.sh` is the shared library the scripts source (see env-file.test.mjs), not a command
  // the one Python script (claude-usage-by-session.py) is checked in its own block below: it is not run by bash
  ...readdirSync(BIN).filter(f => !f.startsWith("_") && !f.endsWith(".py")).map(f => join(BIN, f)),
  ...readdirSync(EXAMPLES).filter(f => f.endsWith(".sh")).map(f => join(EXAMPLES, f)),
]

describe("every script", () => {
  it("is found (the suite is not vacuous)", () => assert.ok(scripts.length >= 11))

  for (const script of scripts) {
    const name = script.split("/").pop()

    it(`${name}: --help prints the header (Usage, Reads/Writes, Exit), exit 0`, async () => {
      const r = await env.run(script, ["--help"])
      assert.equal(r.code, 0)
      if (name !== "cartera.sh") assert.match(r.stdout, /^Usage|\nUsage/)
      assert.match(r.stdout, /\n\s*(Exit|Exit\/return):/)
      assert.match(r.stdout, /\n(Reads|Writes):/)
      assert.equal(r.stdout.includes("set -u"), false, "the help must stop at the end of the header")
    })

    it(`${name}: is executable and has a bash shebang`, () => {
      assert.ok(statSync(script).mode & 0o100, "not executable")
      const text = readFileSync(script, "utf8")
      assert.match(text, /^#!\/usr\/bin\/env bash\n/)
    })
  }
})

describe("claude-usage-by-session.py", () => {
  const script = join(BIN, "claude-usage-by-session.py")

  it("--help prints the docstring header (Usage, Reads/Writes, Exit), exit 0, and reads no transcript", async () => {
    // an empty HOME: if --help were read as an instant, the (empty) report would print "{}" instead of the header
    const r = spawnSync("python3", ["-I", script, "--help"], {env: {PATH: process.env.PATH, HOME: env.home}, encoding: "utf8"})
    assert.equal(r.status, 0)
    assert.match(r.stdout, /^claude-usage-by-session\.py: where the quota went/)
    assert.match(r.stdout, /\nUsage:/)
    assert.match(r.stdout, /\nExit: /)
    assert.match(r.stdout, /\nReads: /)
    assert.doesNotMatch(r.stdout, /^\{\}\s*$/m)
  })

  it("is executable and has a python3 shebang", () => {
    assert.ok(statSync(script).mode & 0o100, "not executable")
    assert.match(readFileSync(script, "utf8"), /^#!\/usr\/bin\/env python3\n/)
  })
})
