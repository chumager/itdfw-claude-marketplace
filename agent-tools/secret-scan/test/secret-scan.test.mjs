import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {mkdirSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {FAKE_KEY, HAS_GITLEAKS, SCAN, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const files = (...paths) => env.run(SCAN, ["--files", ...paths])
const strictFiles = (...paths) => env.run(SCAN, ["--strict", "--files", ...paths])
const gl = {skip: !HAS_GITLEAKS && "gitleaks is not installed"}

describe("secret-scan.sh --files: credentials block", gl, () => {
  it("a file with a made-up key: BLOQUEA <file>:<line> <rule>, exit 1, and the secret is never printed", async () => {
    const f = env.write("a.js", `const k = "${FAKE_KEY}"\n`)
    const r = await files(f)
    assert.equal(r.code, 1)
    assert.equal(r.stdout, `BLOQUEA ${f}:1 itdfw-sk-key\n`)
    assert.ok(!r.stdout.includes(FAKE_KEY) && !r.stderr.includes(FAKE_KEY))
  })

  it("a clean file passes: no output, exit 0", async () => {
    const r = await files(env.write("b.js", "export const answer = 42\n"))
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("each rule of the config: Mongo URL with a password, JWT, Bearer header, literal password, ITDFW token", async () => {
    const cases = {
      "mongo.txt": ["mongodb://admin:hunter2pw@db.example.invalid/x\n", "itdfw-mongo-url-credenciales"],
      "jwt.txt": ["t = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef\n", "itdfw-jwt"],
      "bearer.txt": ["Authorization: Bearer abcdefghijklmnop1234\n", "itdfw-bearer"],
      "pw.txt": [`password = "correct-horse"\n`, "itdfw-password-literal"],
      "uuid.txt": ["x-itd-access: 123e4567-e89b-12d3-a456-426614174000\n", "itdfw-api-token-uuid"],
    }
    for (const [name, [content, rule]] of Object.entries(cases)) {
      const f = env.write(name, content)
      const r = await files(f)
      assert.equal(r.code, 1, `${name}: ${r.stdout}${r.stderr}`)
      assert.match(r.stdout, new RegExp(`^BLOQUEA ${f}:1 ${rule}$`, "m"), name)
    }
  })

  it("files that are never pushed, by name: .env, .env.local, id_rsa, a .pem and .mcp.json", async () => {
    for (const name of [".env", ".env.local", "id_rsa", "cert.pem", "sub/.mcp.json"]) {
      const f = env.write(name, "nothing secret in here\n")
      const r = await files(f)
      assert.equal(r.code, 1, name)
      assert.match(r.stdout, /^BLOQUEA .* itdfw-archivo-/, name)
    }
  })

  it("a line marked // scan-ok or # scan-ok is a made-up fixture and passes; the next line is still scanned", async () => {
    const f = env.write("fx.js", `const a = "${FAKE_KEY}" // scan-ok\nconst b = "${FAKE_KEY}"\n`)
    const r = await files(f)
    assert.equal(r.stdout, `BLOQUEA ${f}:2 itdfw-sk-key\n`)
    assert.equal((await files(env.write("fx.sh", `K="${FAKE_KEY}" # scan-ok\n`))).code, 0)
  })

  it("a path that does not exist is skipped without a word", async () => {
    const r = await files(join(env.work, "missing.js"))
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("several files: one line per finding, the clean one adds nothing", async () => {
    const a = env.write("a.js", `x = "${FAKE_KEY}"\n`)
    const b = env.write("b.js", "ok\n")
    const c = env.write("c.txt", "Authorization: Bearer abcdefghijklmnop1234\n")
    const r = await files(a, b, c)
    assert.equal(r.code, 1)
    assert.deepEqual(r.stdout.trim().split("\n").sort(), [`BLOQUEA ${a}:1 itdfw-sk-key`, `BLOQUEA ${c}:1 itdfw-bearer`].sort())
  })
})

describe("secret-scan.sh: own hosts and paths warn, and block with --strict", gl, () => {
  it("a home directory path: AVISA and exit 0; with --strict BLOQUEA and exit 1", async () => {
    const f = env.write("p.txt", "cd /home/dana/project\n")
    let r = await files(f)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, `AVISA ${f}:1 itdfw-ruta-propia\n`)
    r = await strictFiles(f)
    assert.equal(r.code, 1)
    assert.equal(r.stdout, `BLOQUEA ${f}:1 itdfw-ruta-propia\n`)
  })

  it("/etc/itdfw/ is the documented path of the product: strict does not flag it", async () => {
    const f = env.write("x.yaml", "config: /etc/itdfw/x.yaml\n")
    const r = await strictFiles(f)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("/etc/itdfw/ stays clean even when the own-paths pattern is broad enough to match /etc/; another /etc file does not", async () => {
    const broad = {SECRET_SCAN_OWN_PATHS: "/etc/|/srv/app/"}
    const ok = env.write("x.yaml", "config: /etc/itdfw/x.yaml\n")
    const other = env.write("y.txt", "read /etc/hosts\n")
    let r = await env.run(SCAN, ["--strict", "--files", ok], {extraEnv: broad})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    r = await env.run(SCAN, ["--strict", "--files", other], {extraEnv: broad})
    assert.equal(r.code, 1)
    assert.equal(r.stdout, `BLOQUEA ${other}:1 itdfw-ruta-propia\n`)
  })

  it("SECRET_SCAN_OWN_PATHS replaces the default; set to empty it switches the rule off", async () => {
    const f = env.write("p.txt", "cd /home/dana/project and /srv/app/x\n")
    let r = await env.run(SCAN, ["--files", f], {extraEnv: {SECRET_SCAN_OWN_PATHS: "/srv/app/"}})
    assert.equal(r.stdout, `AVISA ${f}:1 itdfw-ruta-propia\n`)
    r = await env.run(SCAN, ["--files", env.write("q.txt", "cd /home/dana/project\n")], {extraEnv: {SECRET_SCAN_OWN_PATHS: "/srv/app/"}})
    assert.equal(r.stdout, "")
    r = await env.run(SCAN, ["--strict", "--files", f], {extraEnv: {SECRET_SCAN_OWN_PATHS: ""}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("SECRET_SCAN_OWN_HOSTS: with no value there is no host rule; with one, the host warns and blocks in strict", async () => {
    const f = env.write("h.txt", "curl https://app.acme.example.invalid/x\n")
    assert.equal((await strictFiles(f)).stdout, "")
    const e = {SECRET_SCAN_OWN_HOSTS: "acme\\.example\\.invalid"}
    let r = await env.run(SCAN, ["--files", f], {extraEnv: e})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, `AVISA ${f}:1 itdfw-host-propio\n`)
    r = await env.run(SCAN, ["--strict", "--files", f], {extraEnv: e})
    assert.equal(r.code, 1)
    assert.equal(r.stdout, `BLOQUEA ${f}:1 itdfw-host-propio\n`)
  })

  it("the settings can live in the config file; the environment wins over it", async () => {
    const cfg = env.write(join(env.home, ".config", "secret-scan", "env"), "SECRET_SCAN_OWN_HOSTS=acme\\.example\\.invalid\n# a comment\n")
    const f = env.write("h.txt", "https://app.acme.example.invalid\n")
    const viaFile = {SECRET_SCAN_ENV: cfg}
    assert.equal((await env.run(SCAN, ["--files", f], {extraEnv: viaFile})).stdout, `AVISA ${f}:1 itdfw-host-propio\n`)
    const overridden = {...viaFile, SECRET_SCAN_OWN_HOSTS: "other\\.example\\.invalid"}
    assert.equal((await env.run(SCAN, ["--files", f], {extraEnv: overridden})).stdout, "")
  })

  it("SECRET_SCAN_ALLOW_PATHS leaves matching files out entirely, even for a credential", async () => {
    const f = env.write("html/assets/chunk-AbCd1234.js", `k = "${FAKE_KEY}"\n`)
    assert.equal((await files(f)).code, 1)
    const r = await env.run(SCAN, ["--files", f], {extraEnv: {SECRET_SCAN_ALLOW_PATHS: "(^|/)assets/[^/]+-[A-Za-z0-9_-]{8}\\.js$"}})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("a regex with three single quotes in a row is refused (it would break the TOML), exit 2", async () => {
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {extraEnv: {SECRET_SCAN_OWN_HOSTS: "a'''b"}})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /SECRET_SCAN_OWN_HOSTS cannot contain three single quotes/)
  })
})

describe("secret-scan.sh: reviewed false positives (secret-scan.ignore)", gl, () => {
  it("a fingerprint <file>:<rule>:<line> silences that finding; comments and blank lines are ignored; others still show", async () => {
    const f = env.write("a.js", `x = "${FAKE_KEY}"\ny = "${FAKE_KEY}"\n`)
    const ignore = env.write("my.ignore", `# reviewed by hand\n\n${f}:itdfw-sk-key:1\n`)
    const r = await env.run(SCAN, ["--files", f], {extraEnv: {SECRET_SCAN_IGNORE: ignore}})
    assert.equal(r.code, 1)
    assert.equal(r.stdout, `BLOQUEA ${f}:2 itdfw-sk-key\n`)
    const both = env.write("both.ignore", `${f}:itdfw-sk-key:1\n${f}:itdfw-sk-key:2\n`)
    const clean = await env.run(SCAN, ["--files", f], {extraEnv: {SECRET_SCAN_IGNORE: both}})
    assert.equal(clean.code, 0)
    assert.equal(clean.stdout, "")
  })

  it("without a file next to the script and no variable: nothing is ignored", async () => {
    const f = env.write("a.js", `x = "${FAKE_KEY}"\n`)
    assert.equal((await files(f)).code, 1)
  })
})

describe("secret-scan.sh <range>: the diff of commits", gl, () => {
  it("a commit that adds a key is found by file and line; the clean range and the empty range exit 0", async () => {
    const {dir} = env.repo()
    const base = env.git(dir, "rev-parse", "HEAD")
    writeFileSync(join(dir, "ok.js"), "export const a = 1\n")
    env.git(dir, "add", "-A"); env.git(dir, "commit", "-q", "-m", "clean")
    let r = await env.run(SCAN, [`${base}..HEAD`], {cwd: dir})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    writeFileSync(join(dir, "leak.js"), `\nconst k = "${FAKE_KEY}"\n`)
    env.git(dir, "add", "-A"); env.git(dir, "commit", "-q", "-m", "leak")
    r = await env.run(SCAN, [`${base}..HEAD`], {cwd: dir})
    assert.equal(r.code, 1)
    assert.equal(r.stdout, "BLOQUEA leak.js:2 itdfw-sk-key\n")
    r = await env.run(SCAN, ["HEAD..HEAD"], {cwd: dir})
    assert.equal(r.code, 0)
  })

  it("a bad range exits 2, and so does running it outside a git repository", async () => {
    const {dir} = env.repo()
    let r = await env.run(SCAN, ["no-such-ref..HEAD"], {cwd: dir})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /invalid range: no-such-ref\.\.HEAD/)
    r = await env.run(SCAN, ["HEAD~1..HEAD"], {cwd: env.work})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /not a git repository/)
  })
})

describe("secret-scan.sh: usage and the scanner itself", () => {
  it("no arguments: usage on stderr and exit 2; --help prints the header and exits 0", async () => {
    let r = await env.run(SCAN, [])
    assert.equal(r.code, 2)
    assert.match(r.stderr, /^usage: secret-scan\.sh/)
    r = await env.run(SCAN, ["--help"])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^secret-scan\.sh: secret scan with gitleaks/)
  })

  it("SECRET_SCAN_GITLEAKS pointing at nothing: exit 2, and nothing is installed", async () => {
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {extraEnv: {SECRET_SCAN_GITLEAKS: join(env.root, "nope")}})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /SECRET_SCAN_GITLEAKS is not executable/)
  })

  it("an error of gitleaks itself is reported with its message and exit 2", async () => {
    env.stub("fake-gitleaks", `echo "boom" >&2; exit 7`)
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {extraEnv: {SECRET_SCAN_GITLEAKS: join(env.stubs, "fake-gitleaks")}})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /gitleaks: boom/)
  })

  it("gitleaks says it found something (exit 1) but leaves no report: a broken scan, exit 2, never clean", async () => {
    env.stub("fake-gitleaks", `exit 1`)
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {extraEnv: {SECRET_SCAN_GITLEAKS: join(env.stubs, "fake-gitleaks")}})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /exit 1 with no report/)
  })

  // PATH with the system tools the script needs and no gitleaks; sudo and curl are stubs that only log and fail
  const noGitleaksPath = () => {
    env.stub("sudo", `echo "sudo $*" >> "$FAKE_LOG"; exit 1`)
    env.stub("curl", `echo "curl $*" >> "$FAKE_LOG"; exit 1`)
    const min = env.minimalPath(["bash", "env", "jq", "dirname", "readlink", "mktemp", "rm", "cat", "sed", "sort", "awk", "git", "sha256sum", "tar", "install", "mkdir", "head", "grep", "basename"])
    return `${env.stubs}:${min}`
  }

  it("gitleaks missing and SECRET_SCAN_NO_INSTALL=1: exit 2 and neither sudo nor curl is called", async () => {
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {path: noGitleaksPath()})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /gitleaks is missing \(SECRET_SCAN_NO_INSTALL=1/)
    assert.deepEqual(env.calls(), [])
  })

  it("gitleaks missing and the installer allowed: it tries apt through sudo -n, then the pinned release, and reports exit 2", async () => {
    const r = await env.run(SCAN, ["--files", env.write("a.txt", "x\n")], {path: noGitleaksPath(), extraEnv: {SECRET_SCAN_NO_INSTALL: ""}})
    assert.equal(r.code, 2)
    assert.match(r.stderr, /could not install gitleaks 8\.16\.0/)
    const calls = env.calls()
    assert.equal(calls[0], "sudo -n apt-get install -y gitleaks")
    assert.match(calls[1], /^curl -fsSL -o .*gitleaks_8\.16\.0_linux_x64\.tar\.gz https:\/\/github\.com\/gitleaks\/gitleaks\/releases\/download\/v8\.16\.0\//)
  })
})

describe("secret-scan.sh: no personal data of its own", () => {
  it("the shipped files name no machine, person or private host", async () => {
    const {readFileSync, readdirSync} = await import("node:fs")
    const {ROOT} = await import("./helpers.mjs")
    for (const name of ["secret-scan.sh", "secret-scan.toml", "push-develop.sh", "_env.sh", "README.md"]) {
      const text = readFileSync(join(ROOT, name), "utf8")
      assert.doesNotMatch(text, /jcmunoz|itdmovil|\/home\/jc|\$HOME\/bin|\/var\/www\//, name)
    }
    assert.ok(readdirSync(ROOT).includes("secret-scan.toml"))
    assert.ok(!readdirSync(ROOT).includes("secret-scan.ignore"), "the fingerprint file of a private repository is not shipped")
  })
})
