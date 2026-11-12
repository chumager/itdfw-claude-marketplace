// The optional local config file: ${XDG_CONFIG_HOME:-$HOME/.config}/claude-sessions/env (or $CLAUDE_SESSIONS_ENV).
// The observer is claude-broadcast.sh: its sender name (CLAUDE_BROADCAST_FROM) shows up in what a session receives.
import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {BIN, EXAMPLES, makeEnv, messageOf} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const BROADCAST = join(BIN, "claude-broadcast.sh")

/** Writes the config file where the scripts look by default (under the fake HOME) and returns its path. */
function writeDefaultConfig(text) {
  const dir = join(env.home, ".config", "claude-sessions")
  mkdirSync(dir, {recursive: true})
  writeFileSync(join(dir, "env"), text)
  return join(dir, "env")
}

/** Broadcasts "hi" to one fake session and returns the from-name that arrived (null when nothing arrived). */
async function senderSeen(extraEnv = {}, script = BROADCAST) {
  const s = await env.session({name: "alpha"})
  const r = await env.run(script, ["hi"], {extraEnv})
  assert.equal(r.code, 0, r.stderr)
  return messageOf(s)?.match(/from-name="([^"]*)"/)?.[1] ?? null
}

describe("local env file", () => {
  it("absent: nothing changes (the script's own default applies)", async () => {
    assert.equal(await senderSeen(), "user")
  })

  it("present at the default path ($HOME/.config/claude-sessions/env): its values are used", async () => {
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromfile\n")
    assert.equal(await senderSeen(), "fromfile")
  })

  it("XDG_CONFIG_HOME moves the default path", async () => {
    const xdg = join(env.root, "xdg")
    mkdirSync(join(xdg, "claude-sessions"), {recursive: true})
    writeFileSync(join(xdg, "claude-sessions", "env"), "CLAUDE_BROADCAST_FROM=fromxdg\n")
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromhome\n")
    assert.equal(await senderSeen({XDG_CONFIG_HOME: xdg}), "fromxdg")
  })

  it("CLAUDE_SESSIONS_ENV points to another file", async () => {
    const other = join(env.root, "other.env")
    writeFileSync(other, "CLAUDE_BROADCAST_FROM=fromother\n")
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromhome\n")
    assert.equal(await senderSeen({CLAUDE_SESSIONS_ENV: other}), "fromother")
  })

  it("CLAUDE_SESSIONS_ENV pointing to a missing file: nothing changes", async () => {
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromhome\n")
    assert.equal(await senderSeen({CLAUDE_SESSIONS_ENV: join(env.root, "nope")}), "user")
  })

  it("what is already in the environment wins over the file", async () => {
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromfile\n")
    assert.equal(await senderSeen({CLAUDE_BROADCAST_FROM: "fromenv"}), "fromenv")
  })

  it("a variable set to the empty string in the environment also wins (the file does not fill it in)", async () => {
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromfile\n")
    // the script falls back to "user" for an empty value
    assert.equal(await senderSeen({CLAUDE_BROADCAST_FROM: ""}), "user")
  })

  it("a line that tries to run something is data, not code: nothing runs, the value stays literal", async () => {
    const pwned = join(env.root, "pwned")
    writeDefaultConfig(`TOUCHED=$(touch ${pwned})\nCLAUDE_BROADCAST_FROM=$(touch ${pwned}-2)\nBACKTICK=\`touch ${pwned}-3\`\n`)
    assert.equal(await senderSeen(), `$(touch ${pwned}-2)`)
    for (const f of [pwned, `${pwned}-2`, `${pwned}-3`]) assert.equal(existsSync(f), false, f)
  })

  it("only KEY=value lines count: comments, blanks, lowercase keys, `export` and junk are ignored", async () => {
    writeDefaultConfig([
      "# CLAUDE_BROADCAST_FROM=commented",
      "",
      "   # CLAUDE_BROADCAST_FROM=indented comment",
      "claude_broadcast_from=lower",
      "export CLAUDE_BROADCAST_FROM=exported",
      "CLAUDE_BROADCAST_FROM",
      "garbage here",
      "CLAUDE_BROADCAST_FROM=real",
      "",
    ].join("\n"))
    assert.equal(await senderSeen(), "real")
  })

  it("the value is everything after the first `=`, `=` and spaces included; one pair of quotes is stripped; CRLF is tolerated", async () => {
    writeDefaultConfig('CLAUDE_BROADCAST_FROM="a b=c"\r\n')
    assert.equal(await senderSeen(), "a b=c")
  })

  it("a last line with no newline is read", async () => {
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=nolf")
    assert.equal(await senderSeen(), "nolf")
  })

  it("it also works through a symlink (how ~/bin points to the plugin)", async () => {
    const link = join(env.root, "linked-broadcast.sh")
    symlinkSync(BROADCAST, link)
    writeDefaultConfig("CLAUDE_BROADCAST_FROM=fromfile\n")
    assert.equal(await senderSeen({}, link), "fromfile")
  })
})

describe("every script loads it, first thing", () => {
  const scripts = [
    ...readdirSync(BIN).filter(f => f.endsWith(".sh") && !f.startsWith("_")).map(f => join(BIN, f)),
    ...readdirSync(EXAMPLES).filter(f => f.endsWith(".sh")).map(f => join(EXAMPLES, f)),
  ]
  it("is found (the suite is not vacuous)", () => assert.ok(scripts.length >= 12))

  for (const script of scripts) {
    // xtrace is the observer: a script that loaded the file shows the `export` of the probe variable on --help,
    // which exits before doing anything else
    it(`${script.split("/").pop()}: exports the file's variables when it starts`, async () => {
      writeDefaultConfig("CLAUDE_SESSIONS_PROBE=yes\n")
      const r = await env.run(script, ["--help"], {extraEnv: {SHELLOPTS: "xtrace"}})
      assert.equal(r.code, 0, r.stderr)
      assert.match(r.stderr, /export CLAUDE_SESSIONS_PROBE=yes/)
    })
  }
})
