import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {existsSync, readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {FAKE_KEY, HAS_GITLEAKS, PUSH, makeEnv} from "./helpers.mjs"

let env
beforeEach(() => { env = makeEnv() })
afterEach(() => env.cleanup())

const gl = {skip: !HAS_GITLEAKS && "gitleaks is not installed"}
const tip = origin => env.git(origin, "rev-parse", "refs/heads/develop")
const commit = (dir, file, content, msg = "change") => {
  writeFileSync(join(dir, file), content)
  env.git(dir, "add", "-A")
  env.git(dir, "commit", "-q", "-m", msg)
  return env.git(dir, "rev-parse", "HEAD")
}
const cache = name => join(env.root, "cache", name)
const post = (dir, extraEnv = {}) => env.run(PUSH, [], {cwd: dir, extraEnv})

describe("push-develop.sh: a clean commit on develop goes out", gl, () => {
  it("scans origin/develop..HEAD, says it pushes in the background, and the remote ends up at that commit", async () => {
    const {dir, origin} = env.repo()
    const sha = commit(dir, "ok.js", "export const a = 1\n")
    const r = await post(dir)
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^↑ push to origin\/develop in the background \(result in .*last\.log\)\n$/)
    assert.ok(await env.waitFor(() => tip(origin) === sha), "the remote reached the commit")
    assert.ok(await env.waitFor(() => existsSync(cache("last.log")) && /✓ pushed /.test(readFileSync(cache("last.log"), "utf8"))))
    assert.equal(readFileSync(cache("pending"), "utf8"), "")
  })

  it("a warning (own host) is counted in a line and does not stop the push", async () => {
    const {dir, origin} = env.repo()
    const sha = commit(dir, "h.txt", "https://app.acme.example.invalid\n")
    const r = await post(dir, {SECRET_SCAN_OWN_HOSTS: "acme\\.example\\.invalid"})
    assert.match(r.stdout, /^ⓘ 1 warnings about own hosts\/paths \(details in .*last-scan\.txt\)\n↑ push to origin\/develop/)
    assert.ok(await env.waitFor(() => tip(origin) === sha))
  })
})

describe("push-develop.sh: a commit that leaks does not go out", gl, () => {
  it("prints the findings, writes a pending line, does not start the push; the next commit prints the pending failure", async () => {
    const {dir, origin} = env.repo()
    const before = tip(origin)
    const sha = commit(dir, "leak.js", `\nconst k = "${FAKE_KEY}"\n`, "leak")
    let r = await post(dir)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "🔴 push stopped: 1 findings — fix the commit before it goes out\n   leak.js:2 itdfw-sk-key\n")
    assert.ok(!r.stdout.includes(FAKE_KEY))
    assert.equal(tip(origin), before)
    assert.match(readFileSync(cache("pending"), "utf8"), new RegExp(`\\[repo\\] push stopped by the scan at ${sha.slice(0, 8)}: 1 findings`))
    // a second post-commit with the failure still unresolved: it is listed first
    r = await post(dir)
    assert.match(r.stdout, /^🔴 push-develop has unresolved failures:\n   \[repo\] push stopped by the scan at [0-9a-f]{8}: 1 findings \(last \d{4}-\d\d-\d\d /)
  })

  it("after the commit is fixed the push goes out and the pending list is cleared", async () => {
    const {dir, origin} = env.repo()
    commit(dir, "leak.js", `const k = "${FAKE_KEY}"\n`, "leak")
    await post(dir)
    assert.notEqual(readFileSync(cache("pending"), "utf8"), "")
    writeFileSync(join(dir, "leak.js"), "const k = process.env.KEY\n")
    env.git(dir, "add", "-A"); env.git(dir, "commit", "-q", "--amend", "-m", "fixed")
    const fixed = env.git(dir, "rev-parse", "HEAD")
    const r = await post(dir)
    assert.match(r.stdout, /↑ push to origin\/develop in the background/)
    assert.ok(await env.waitFor(() => tip(origin) === fixed))
    assert.ok(await env.waitFor(() => readFileSync(cache("pending"), "utf8") === ""))
  })
})

describe("push-develop.sh: when it does nothing", () => {
  it("on another branch: silent, nothing pushed, no state written", async () => {
    const {dir, origin} = env.repo()
    const before = tip(origin)
    env.git(dir, "checkout", "-q", "-b", "feature")
    commit(dir, "f.js", "x\n")
    const r = await post(dir)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    assert.equal(tip(origin), before)
    assert.equal(existsSync(cache("last-scan.txt")), false)
  })

  it("outside a git repository: silent, exit 0", async () => {
    const r = await post(env.work)
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
  })

  it("PUSH_DEVELOP_INNER (a commit made by its own rebase): exits at once", async () => {
    const {dir} = env.repo()
    commit(dir, "f.js", "x\n")
    const r = await post(dir, {PUSH_DEVELOP_INNER: "1"})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "")
    assert.equal(existsSync(cache("last-scan.txt")), false)
  })

  it("PUSH_DEVELOP_BRANCH moves the branch it acts on", async () => {
    const {dir} = env.repo("repo", "main")
    commit(dir, "f.js", "x\n")
    env.stub("scan", `echo "$*" >> "$FAKE_LOG"; exit 0`)
    let r = await post(dir, {SECRET_SCAN: join(env.stubs, "scan")})
    assert.equal(r.stdout, "")
    r = await post(dir, {SECRET_SCAN: join(env.stubs, "scan"), PUSH_DEVELOP_BRANCH: "main"})
    assert.match(r.stdout, /↑ push to origin\/main in the background/)
  })

  it("--help prints the header and does not touch the state directory", async () => {
    const r = await env.run(PUSH, ["--help"])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /^push-develop\.sh: automatic push to origin\/develop/)
    assert.equal(existsSync(cache("lock")), false)
  })
})

describe("push-develop.sh: the scanner did not run (a stub as SECRET_SCAN)", () => {
  it("a scan that fails (exit 2) stops the push and shows its first line; it is a pending failure", async () => {
    const {dir, origin} = env.repo()
    const before = tip(origin)
    commit(dir, "f.js", "x\n")
    env.stub("scan", `echo "✗ gitleaks is missing"; exit 2`)
    const r = await post(dir, {SECRET_SCAN: join(env.stubs, "scan")})
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "🔴 push stopped: the scan did not run (✗ gitleaks is missing)\n")
    assert.equal(tip(origin), before)
    assert.match(readFileSync(cache("pending"), "utf8"), /\[repo\] scan failed at [0-9a-f]{8}/)
  })

  it("a clean scan (exit 0) pushes; the scanner receives origin/develop..<sha> as its range", async () => {
    const {dir, origin} = env.repo()
    const base = env.git(dir, "rev-parse", "HEAD")
    const sha = commit(dir, "f.js", "x\n")
    env.stub("scan", `echo "$*" >> "$FAKE_LOG"; exit 0`)
    await post(dir, {SECRET_SCAN: join(env.stubs, "scan")})
    assert.deepEqual(env.calls(), [`origin/develop..${sha}`])
    assert.ok(await env.waitFor(() => tip(origin) === sha))
    assert.notEqual(base, sha)
  })
})

describe("push-develop.sh: the remote moved ahead (the background part rebases by itself)", () => {
  it("clean tree, no conflict: it fetches, rebases, scans what goes out and pushes the rebased commit", async () => {
    const {dir, origin} = env.repo()
    const other = join(env.root, "other")
    env.git(env.root, "clone", "-q", origin, other)
    commit(other, "theirs.js", "theirs\n", "theirs")
    env.git(other, "push", "-q", "origin", "develop")
    const theirs = tip(origin)
    commit(dir, "mine.js", "mine\n", "mine")
    env.stub("scan", `echo "$*" >> "$FAKE_LOG"; exit 0`)
    const r = await post(dir, {SECRET_SCAN: join(env.stubs, "scan")})
    assert.match(r.stdout, /↑ push to origin\/develop in the background/)
    assert.ok(await env.waitFor(() => tip(origin) !== theirs))
    assert.equal(env.git(origin, "log", "--format=%s", "-3").split("\n").join(","), "mine,theirs,start")
    assert.ok(await env.waitFor(() => /✓ rebased and pushed /.test(readFileSync(cache("last.log"), "utf8"))))
    assert.equal(env.calls().length, 2, "scanned once before the push and once after the rebase")
    assert.match(env.calls()[1], /^origin\/develop\.\.HEAD$/)
  })

  it("a conflict is predicted: nothing is touched and the pending list says how to resolve it", async () => {
    const {dir, origin} = env.repo()
    const other = join(env.root, "other")
    env.git(env.root, "clone", "-q", origin, other)
    commit(other, "README", "theirs\n", "theirs")
    env.git(other, "push", "-q", "origin", "develop")
    const theirs = tip(origin)
    const mine = commit(dir, "README", "mine\n", "mine")
    env.stub("scan", `exit 0`)
    await post(dir, {SECRET_SCAN: join(env.stubs, "scan")})
    assert.ok(await env.waitFor(() => existsSync(cache("pending")) && /would conflict/.test(readFileSync(cache("pending"), "utf8"))))
    assert.equal(tip(origin), theirs)
    assert.equal(env.git(dir, "rev-parse", "HEAD"), mine)
    assert.match(readFileSync(cache("last.log"), "utf8"), /✗ remote ahead with predicted conflicts: touching nothing/)
  })
})
