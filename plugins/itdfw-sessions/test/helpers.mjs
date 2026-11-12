// Throwaway HOME with fake session files, fake unix sockets and stubs; never touches a real ~/.claude.
import {spawn} from "node:child_process"
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync} from "node:fs"
import {createServer} from "node:net"
import {join, dirname} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
export const BIN = join(HERE, "..", "bin")
export const EXAMPLES = join(HERE, "..", "examples")

/**
 * Creates an isolated environment: a temp root holding a fake HOME (.claude/sessions, .claude/state) and a stubs dir (first in PATH).
 * @returns {object} env with run(), stub(), session(), calls(), cleanup() and the paths.
 */
export function makeEnv() {
  const root = mkdtempSync("/tmp/isx-")
  const home = join(root, "home")
  const claude = join(home, ".claude")
  const stubs = join(root, "stubs")
  for (const d of [join(claude, "sessions"), join(claude, "state"), stubs, join(home, ".local", "bin")]) mkdirSync(d, {recursive: true})
  const servers = []
  const children = []

  const env = {
    root, home, claude, stubs,
    sessions: join(claude, "sessions"),
    state: join(claude, "state"),
    log: join(root, "calls.log"),

    /** Runs a script (absolute path) asynchronously, so this process can keep serving the fake sockets. */
    run(script, args = [], {extraEnv = {}, cwd = root, stdin = null} = {}) {
      return new Promise(resolve => {
        const e = {PATH: `${stubs}:${process.env.PATH}`, HOME: home, LANG: "C", TZ: "UTC", FAKE_LOG: env.log, ...extraEnv}
        const child = spawn("bash", [script, ...args], {env: e, cwd, stdio: ["pipe", "pipe", "pipe"]})
        let stdout = "", stderr = ""
        child.stdout.on("data", d => { stdout += d })
        child.stderr.on("data", d => { stderr += d })
        child.on("close", code => resolve({code, stdout, stderr}))
        if (stdin !== null) child.stdin.write(stdin)
        child.stdin.end()
      })
    },

    /** Writes an executable stub (a bash script) named `name` in the stubs dir (or in `dir`). */
    stub(name, body, dir = stubs) {
      const f = join(dir, name)
      writeFileSync(f, `#!/usr/bin/env bash\n${body}\n`)
      chmodSync(f, 0o755)
    },

    /** Lines the stubs appended to the call log. */
    calls() { return existsSync(env.log) ? readFileSync(env.log, "utf8").split("\n").filter(Boolean) : [] },

    /**
     * A fake live session: session file + key file + a unix socket that records what arrives.
     * @param {object} o name, spare, key (write the key file), socket (listen), alive, pid (use a given pid)
     * @returns {Promise<{pid:number, name:string, token:string, received:string[]}>}
     */
    async session({name, spare = false, key = true, socket = true, alive = true, pid = null, token = `tok-${name}`}) {
      if (pid === null) {
        const child = spawn(alive ? "sleep" : "true", alive ? ["600"] : [])
        children.push(child)
        pid = child.pid
        if (!alive) await new Promise(r => child.on("close", r))
      }
      const sock = join(root, `${name.replace(/\W/g, "_")}-${pid}.sock`)
      const received = []
      if (socket) {
        await new Promise(resolve => {
          const srv = createServer(c => {
            let buf = ""
            c.on("data", d => { buf += d })
            c.on("end", () => { received.push(...buf.split("\n").filter(Boolean)); c.end() })
            c.on("error", () => {})
          })
          servers.push(srv)
          srv.listen(sock, resolve)
        })
      }
      writeFileSync(join(env.sessions, `${pid}.json`), JSON.stringify({pid, name, sessionId: `sid-${name}`, messagingSocketPath: sock, spare}))
      if (key) writeFileSync(join(env.sessions, `${pid}.abc123.key`), JSON.stringify({peerToken: token}))
      return {pid, name, token, received}
    },

    cleanup() {
      for (const s of servers) s.close()
      for (const c of children) c.kill()
      rmSync(root, {recursive: true, force: true})
    },
  }
  return env
}

/** Parses what a fake session received: [auth line, user message line] as objects. */
export function parseReceived(session) {
  return session.received.map(l => JSON.parse(l))
}

/** The text of the cross-session message a fake session received (null when nothing arrived). */
export function messageOf(session) {
  const lines = parseReceived(session)
  return lines.find(l => l.type === "user")?.message.content ?? null
}
