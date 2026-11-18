import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {existsSync, mkdirSync, readFileSync, readdirSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

let env

// tmux: `list-clients` prints $FAKE_CLIENTS (first $FAKE_CLIENT_CALLS calls only, when set); `display-popup` runs the
// popup script (run), closes with no answer (skip) or stays open until `display-popup -C` (hang, like a real popup)
const TMUX_STUB = `
case "$1" in
  list-clients)
    n=$(cat "$FAKE_LOG.lc" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$FAKE_LOG.lc"
    [ -n "\${FAKE_CLIENTS:-}" ] || exit 0
    [ -n "\${FAKE_CLIENT_CALLS:-}" ] && [ "$n" -gt "$FAKE_CLIENT_CALLS" ] && exit 0
    printf '%s\\n' "$FAKE_CLIENTS" ;;
  display-popup)
    if [ "$2" = "-C" ]; then echo "popup-close $*" >> "$FAKE_LOG"; touch "$FAKE_LOG.closed"; exit 0; fi
    echo "popup $*" >> "$FAKE_LOG"
    case "\${FAKE_POPUP:-run}" in
      run) "\${@: -1}" > /dev/null ;; # a real popup has its own terminal, its text never reaches stdout
      skip) ;;
      hang) for i in $(seq 250); do [ -e "$FAKE_LOG.closed" ] && break; sleep 0.02; done ;;
    esac ;;
esac`

// fzf: records its arguments and the options it was given, and answers line N of $FAKE_FZF_CHOICES on its Nth call
const FZF_STUB = `
cat > "$FAKE_LOG.opts"
echo "fzf $*" >> "$FAKE_LOG"
n=$(cat "$FAKE_LOG.fz" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$FAKE_LOG.fz"
printf '%s\\n' "$FAKE_FZF_CHOICES" | sed -n "\${n}p"`

beforeEach(() => {
  env = makeEnv()
  env.stub("tmux", TMUX_STUB)
  env.stub("fzf", FZF_STUB)
  mkdirSync(join(env.root, "tmp"))
})
afterEach(() => env.cleanup())

describe("owner-present.sh", () => {
  const SCRIPT = join(BIN, "owner-present.sh")

  it("exit 0 and the client name when a tmux client is attached", async () => {
    const r = await env.run(SCRIPT, [], {extraEnv: {FAKE_CLIENTS: "/dev/pts/7"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "/dev/pts/7\n")
  })

  it("with several clients it prints only the first", async () => {
    const r = await env.run(SCRIPT, [], {extraEnv: {FAKE_CLIENTS: "/dev/pts/7\n/dev/pts/9"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "/dev/pts/7\n")
  })

  it("exit 1 and silence when no client is attached", async () => {
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 1)
    assert.equal(r.stdout, "")
  })

  it("exit 1 and silence when tmux itself fails (no server running)", async () => {
    env.stub("tmux", "echo 'no server running' >&2; exit 1")
    const r = await env.run(SCRIPT)
    assert.equal(r.code, 1)
    assert.equal(r.stdout, "")
    assert.equal(r.stderr, "")
  })
})

describe("ask-owner.sh", () => {
  const SCRIPT = join(BIN, "ask-owner.sh")
  const ask = (args, extraEnv = {}, opts = {}) => env.run(SCRIPT, args, {
    extraEnv: {FAKE_CLIENTS: "client-1", ASK_OWNER_LOCK: join(env.root, "ask.lock"), TMPDIR: join(env.root, "tmp"), ...extraEnv},
    ...opts,
  })

  it("exit 0 and the chosen option on stdout; the popup goes to the attached client with the title as header", async () => {
    const r = await ask(["Deploy now?", "Yes", "No"], {FAKE_FZF_CHOICES: "Yes"})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "Yes\n")
    const calls = env.calls()
    assert.match(calls.find(l => l.startsWith("popup")), /^popup display-popup -c client-1 -E -w 80% -h 60% -T .* ❓ \d\d:\d\d /)
    assert.match(calls.find(l => l.startsWith("fzf")), /--header=Deploy now\?/)
    assert.equal(readFileSync(`${env.log}.opts`, "utf8"), "Yes\nNo\nSay what to do…\n", "the free-text option is always the last one")
  })

  it("exit 0 and the typed text when 'Say what to do…' is chosen", async () => {
    const r = await ask(["Q", "A"], {FAKE_FZF_CHOICES: "Say what to do…"}, {stdin: "do it on Friday\n"})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "do it on Friday\n")
  })

  it("an empty Enter after 'Say what to do…' goes back to the menu", async () => {
    const r = await ask(["Q", "A"], {FAKE_FZF_CHOICES: "Say what to do…\nA"}, {stdin: "\n"})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "A\n")
    assert.equal(env.calls().filter(l => l.startsWith("fzf")).length, 2)
  })

  it("the popup runs the fzf named by ASK_OWNER_FZF", async () => {
    env.stub("my-fzf", `echo "my-fzf" >> "$FAKE_LOG"; cat > /dev/null; echo A`)
    const r = await ask(["Q", "A"], {ASK_OWNER_FZF: join(env.stubs, "my-fzf")})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "A\n")
    assert.ok(env.calls().includes("my-fzf"))
    assert.equal(env.calls().some(l => l.startsWith("fzf ")), false)
  })

  it("exit 2 and 'no está' when no client is attached; no popup, no lock taken", async () => {
    const r = await ask(["Q", "A"], {FAKE_CLIENTS: ""})
    assert.equal(r.code, 2)
    assert.equal(r.stdout, "no está\n")
    assert.equal(env.calls().some(l => l.startsWith("popup")), false)
    assert.equal(existsSync(join(env.root, "ask.lock")), false)
  })

  it("exit 2 when the person left while the question waited in the queue", async () => {
    const r = await ask(["Q", "A"], {FAKE_CLIENT_CALLS: "1", FAKE_FZF_CHOICES: "A"})
    assert.equal(r.code, 2)
    assert.equal(r.stdout, "no está\n")
    assert.equal(env.calls().some(l => l.startsWith("popup")), false)
  })

  it("exit 3 and 'sin respuesta' when the popup closes with no answer", async () => {
    const r = await ask(["Q", "A"], {FAKE_POPUP: "skip"})
    assert.equal(r.code, 3)
    assert.equal(r.stdout, "sin respuesta\n")
  })

  it("the timeout closes the popup from outside (display-popup -C) and the question ends with exit 3", async () => {
    const r = await ask(["Q", "A"], {FAKE_POPUP: "hang", ASK_OWNER_TIMEOUT: "1"})
    assert.equal(r.code, 3)
    assert.equal(r.stdout, "sin respuesta\n")
    assert.ok(env.calls().includes("popup-close display-popup -C -c client-1"))
  })

  it("exit 4 and 'cola llena' when another question holds the popup for twice the timeout", async () => {
    const lock = join(env.root, "ask.lock")
    const holder = spawn("flock", [lock, "sleep", "10"])
    // the holder has the lock once `flock -n` against the same file stops succeeding
    await new Promise(resolve => {
      const poll = () => spawn("flock", ["-n", lock, "true"]).on("close", c => c === 0 ? setTimeout(poll, 20) : resolve())
      poll()
    })
    try {
      const r = await ask(["Q", "A"], {ASK_OWNER_TIMEOUT: "1"})
      assert.equal(r.code, 4)
      assert.equal(r.stdout, "cola llena\n")
      assert.equal(env.calls().some(l => l.startsWith("popup")), false)
    } finally { holder.kill() }
  })

  it("the wait for the lock is twice the timeout (flock -w)", async () => {
    env.stub("flock", `echo "flock $*" >> "$FAKE_LOG"; exit 1`)
    const r = await ask(["Q", "A"], {ASK_OWNER_TIMEOUT: "40"})
    assert.equal(r.code, 4)
    assert.ok(env.calls().includes("flock -w 80 9"))
  })

  it("the default lock lives under XDG_RUNTIME_DIR", async () => {
    const run = join(env.root, "run")
    mkdirSync(run)
    const r = await env.run(SCRIPT, ["Q", "A"], {extraEnv: {FAKE_CLIENTS: "client-1", XDG_RUNTIME_DIR: run, TMPDIR: join(env.root, "tmp"), FAKE_FZF_CHOICES: "A"}})
    assert.equal(r.code, 0)
    assert.ok(existsSync(join(run, "ask-owner.lock")))
  })

  it("leaves no temp file behind", async () => {
    await ask(["Q", "A"], {FAKE_FZF_CHOICES: "A"})
    assert.deepEqual(readdirSync(join(env.root, "tmp")), [])
  })

  it("exit 64 and a message on stderr when no option is given", async () => {
    const r = await ask(["Only a title"])
    assert.equal(r.code, 64)
    assert.match(r.stderr, /options missing/)
    assert.equal(r.stdout, "")
  })

  it("a non-zero exit and a message on stderr when there is no title", async () => {
    const r = await ask([])
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /the title is missing/)
  })
})
