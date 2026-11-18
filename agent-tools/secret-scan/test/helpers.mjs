// Throwaway root with a fake HOME, a stubs dir first in the PATH and helpers to build git repositories; nothing real is touched.
import {spawn, execFileSync, spawnSync} from "node:child_process"
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs"
import {join, dirname} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, "..")
export const SCAN = join(ROOT, "secret-scan.sh")
export const PUSH = join(ROOT, "push-develop.sh")

/** True when a gitleaks binary can be found on the PATH: the cases that run the real scanner are skipped without it. */
export const HAS_GITLEAKS = spawnSync("sh", ["-c", "command -v gitleaks"]).status === 0

// a made-up key that the rule itdfw-sk-key recognises
export const FAKE_KEY = "sk-abcdefghijklmnopqrstuv1234"

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
}

/**
 * Creates an isolated environment.
 * @returns {object} env with run(), stub(), git(), write(), repo(), waitFor(), cleanup() and the paths.
 */
export function makeEnv() {
  const root = mkdtempSync("/tmp/ssx-")
  const home = join(root, "home")
  const stubs = join(root, "stubs")
  const tmp = join(root, "tmp")
  for (const d of [home, stubs, tmp, join(root, "work")]) mkdirSync(d, {recursive: true})

  const env = {
    root, home, stubs, work: join(root, "work"),
    log: join(root, "calls.log"),

    /**
     * Runs a script asynchronously. The environment is the minimum plus `extraEnv`; the config file of secret-scan and
     * the installer are switched off unless a case turns them on.
     */
    run(script, args = [], {extraEnv = {}, cwd = env.work, path = `${stubs}:${process.env.PATH}`} = {}) {
      return new Promise(resolve => {
        const e = {
          PATH: path, HOME: home, LANG: "C", TZ: "UTC", TMPDIR: tmp, FAKE_LOG: env.log,
          SECRET_SCAN_ENV: join(root, "no-such-config"), SECRET_SCAN_NO_INSTALL: "1", PUSH_DEVELOP_CACHE: join(root, "cache"),
          ...GIT_ENV, ...extraEnv,
        }
        const child = spawn(script, args, {env: e, cwd, stdio: ["ignore", "pipe", "pipe"]})
        let stdout = "", stderr = ""
        child.stdout.on("data", d => { stdout += d })
        child.stderr.on("data", d => { stderr += d })
        child.on("close", code => resolve({code, stdout, stderr}))
      })
    },

    /** Writes an executable bash stub named `name` in the stubs dir. */
    stub(name, body) {
      const f = join(stubs, name)
      writeFileSync(f, `#!/usr/bin/env bash\n${body}\n`)
      chmodSync(f, 0o755)
    },

    /** A directory that holds links to the given system tools and nothing else, to use as a PATH. */
    minimalPath(tools) {
      const dir = join(root, "minpath")
      mkdirSync(dir, {recursive: true})
      for (const t of tools) {
        const real = spawnSync("sh", ["-c", `command -v ${t}`]).stdout.toString().trim()
        if (real && !existsSync(join(dir, t))) symlinkSync(real, join(dir, t))
      }
      return dir
    },

    /** Lines the stubs appended to the call log. */
    calls() { return existsSync(env.log) ? readFileSync(env.log, "utf8").split("\n").filter(Boolean) : [] },

    /** Writes a file (relative to the work dir, or absolute) and returns its path. */
    write(rel, content) {
      const f = rel.startsWith("/") ? rel : join(env.work, rel)
      mkdirSync(dirname(f), {recursive: true})
      writeFileSync(f, content)
      return f
    },

    /** Runs git in `dir` and returns its stdout. */
    git(dir, ...args) {
      return execFileSync("git", args, {cwd: dir, env: {PATH: process.env.PATH, HOME: home, ...GIT_ENV}, stdio: ["ignore", "pipe", "pipe"]}).toString().trim()
    },

    /**
     * A repository on branch `branch` with one committed file, whose `origin` is a bare repository that already holds that commit.
     * @returns {{dir: string, origin: string}}
     */
    repo(name = "repo", branch = "develop") {
      const dir = join(root, name)
      const origin = join(root, `${name}-origin.git`)
      mkdirSync(dir)
      env.git(root, "init", "-q", "--bare", "-b", branch, origin)
      env.git(dir, "init", "-q", "-b", branch)
      env.git(dir, "remote", "add", "origin", origin)
      writeFileSync(join(dir, "README"), "start\n")
      env.git(dir, "add", "-A")
      env.git(dir, "commit", "-q", "-m", "start")
      env.git(dir, "push", "-q", "origin", branch)
      return {dir, origin}
    },

    /** Polls until `test()` is truthy (the push runs detached); the timeout is a cap, not a wait. */
    async waitFor(test, cap = 8000) {
      const end = Date.now() + cap
      while (Date.now() < end) {
        if (test()) return true
        await new Promise(r => setTimeout(r, 25))
      }
      return false
    },

    cleanup() { rmSync(root, {recursive: true, force: true}) },
  }
  return env
}
