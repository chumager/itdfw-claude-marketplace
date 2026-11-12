import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {readdirSync, readFileSync, statSync} from "node:fs"
import {join} from "node:path"
import {BIN, EXAMPLES, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const scripts = [
  // `_env.sh` is the shared library the scripts source (see env-file.test.mjs), not a command
  ...readdirSync(BIN).filter(f => !f.startsWith("_")).map(f => join(BIN, f)),
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
