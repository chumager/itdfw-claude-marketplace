// Throwaway HOME and a stubs dir first in the PATH; the hooks never touch a real ~/.claude or ~/.cache.
import {spawn} from "node:child_process"
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {join, dirname} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
export const BIN = join(HERE, "..", "bin")
export const SESSIONS_BIN = join(HERE, "..", "..", "itdfw-sessions", "bin")

/**
 * Creates an isolated environment: a temp root holding a fake HOME (.claude/sessions, .cache) and a stubs dir.
 * @returns {object} env with run(), stub(), calls(), waitFor(), cleanup() and the paths.
 */
export function makeEnv() {
  const root = mkdtempSync("/tmp/ihx-")
  const home = join(root, "home")
  const stubs = join(root, "stubs")
  for (const d of [join(home, ".claude", "sessions"), join(home, ".cache"), stubs]) mkdirSync(d, {recursive: true})

  const env = {
    root, home, stubs,
    claude: join(home, ".claude"),
    cache: join(home, ".cache"),
    log: join(root, "calls.log"),

    /** Runs a script (absolute path, through its own shebang, as Claude Code does) with the hook payload on stdin. */
    run(script, args = [], {extraEnv = {}, stdin = ""} = {}) {
      return new Promise(resolve => {
        const e = {PATH: `${stubs}:${process.env.PATH}`, HOME: home, LANG: "C", TZ: "UTC", FAKE_LOG: env.log, ...extraEnv}
        const child = spawn(script, args, {env: e, cwd: root, stdio: ["pipe", "pipe", "pipe"]})
        let stdout = "", stderr = ""
        child.stdout.on("data", d => { stdout += d })
        child.stderr.on("data", d => { stderr += d })
        child.on("close", code => resolve({code, stdout, stderr}))
        child.stdin.end(stdin)
      })
    },

    /** Writes an executable bash stub named `name` in the stubs dir (or in `dir`). */
    stub(name, body, dir = stubs) {
      const f = join(dir, name)
      writeFileSync(f, `#!/usr/bin/env bash\n${body}\n`)
      chmodSync(f, 0o755)
    },

    /** Lines the stubs appended to the call log. */
    calls() { return existsSync(env.log) ? readFileSync(env.log, "utf8").split("\n").filter(Boolean) : [] },

    /** Polls until `test()` is truthy (a detached process has to finish); the timeout is a cap, not a wait. */
    async waitFor(test, cap = 5000) {
      const end = Date.now() + cap
      while (Date.now() < end) {
        if (test()) return true
        await new Promise(r => setTimeout(r, 20))
      }
      return false
    },

    // a detached script under test (the denial popup half) may still be writing its last file: retry the removal
    cleanup() { rmSync(root, {recursive: true, force: true, maxRetries: 10, retryDelay: 50}) },
  }
  return env
}
