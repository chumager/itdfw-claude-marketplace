import {describe, it, beforeEach, afterEach} from "node:test"
import assert from "node:assert/strict"
import {writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync} from "node:fs"
import {join} from "node:path"
import {BIN, makeEnv} from "./helpers.mjs"

const SCRIPT = join(BIN, "cartera.sh")
let env, dir

beforeEach(() => {
  env = makeEnv()
  dir = join(env.state, "cartera")
})
afterEach(() => env.cleanup())

const as = (session = "a") => (...args) => env.run(SCRIPT, args, {extraEnv: {CARTERA_SESION: session}})
const read = (session = "a") => JSON.parse(readFileSync(join(dir, `${session}.json`), "utf8"))
const task = (session, block, name) => read(session).bloques.find(b => b.bloque === block).tareas.find(t => t.tarea === name)

describe("cartera.sh: tarea", () => {
  it("creates block and task; the line says session, block, task and state", async () => {
    const r = await as()("tarea", "B1", "T1", "en-curso")
    assert.equal(r.code, 0)
    assert.equal(r.stdout, "a: B1 › T1 · en_curso\n")
    const t = task("a", "B1", "T1")
    assert.equal(t.estado, "en_curso")
    assert.equal(typeof t.at, "number")
  })

  it("en-curso --espera keeps what it waits for; the line shows it", async () => {
    const r = await as()("tarea", "B1", "T1", "en-curso", "--espera", "the lock")
    assert.equal(r.stdout, "a: B1 › T1 · en_curso (waiting: the lock)\n")
    assert.equal(task("a", "B1", "T1").espera, "the lock")
  })

  it("pendiente --go stores espera=go; --pregunta stores espera=texto and the question", async () => {
    await as()("tarea", "B1", "go", "pendiente", "--go")
    await as()("tarea", "B1", "ask", "pendiente", "--pregunta", "which one?")
    assert.equal(task("a", "B1", "go").espera, "go")
    assert.deepEqual([task("a", "B1", "ask").espera, task("a", "B1", "ask").pregunta], ["texto", "which one?"])
  })

  it("parqueada --espera works; terminado works; the same task is updated, never duplicated", async () => {
    await as()("tarea", "B1", "T1", "parqueada", "--espera", "next release")
    assert.equal(task("a", "B1", "T1").estado, "parqueada")
    await as()("tarea", "B1", "T1", "terminado")
    const b = read().bloques[0]
    assert.equal(b.tareas.length, 1)
    assert.equal(b.tareas[0].estado, "terminado")
    assert.equal(b.tareas[0].espera, undefined)
  })

  it("exit 2 on bad usage: unknown state, parqueada without --espera, --go with a non-pendiente, missing args", async () => {
    for (const args of [["tarea", "B", "T", "weird"], ["tarea", "B", "T", "parqueada"], ["tarea", "B", "T", "en-curso", "--go"],
      ["tarea", "B", "T", "pendiente", "--pregunta"], ["tarea", "B", "T", "terminado", "--espera", "x"], ["tarea", "B"]]) {
      const r = await as()(...args)
      assert.equal(r.code, 2, args.join(" "))
    }
    assert.equal(existsSync(join(dir, "a.json")), false)
  })

  it("the old 'pendiente --espera' becomes parqueada, with a note on stderr", async () => {
    const r = await as()("tarea", "B1", "T1", "pendiente", "--espera", "another session")
    assert.equal(task("a", "B1", "T1").estado, "parqueada")
    assert.match(r.stderr, /note: 'pendiente --espera' became parqueada/)
  })

  it("pendiente without --go/--pregunta warns on stderr", async () => {
    const r = await as()("tarea", "B1", "T1", "pendiente")
    assert.match(r.stderr, /note: pendiente is what waits for the user/)
  })

  it("exit 1 when the session cannot be deduced", async () => {
    const r = await env.run(SCRIPT, ["tarea", "B", "T", "en-curso"])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /I do not know which session I come from/)
  })

  it("deduces the session from the session file of an ancestor process", async () => {
    await env.session({name: "deduced", pid: process.pid, socket: false})
    const r = await env.run(SCRIPT, ["tarea", "B", "T", "en-curso"])
    assert.equal(r.stdout, "deduced: B › T · en_curso\n")
    assert.ok(existsSync(join(dir, "deduced.json")))
  })

  it("old interface: 'activo <topic>' warns and makes block and task of the same name", async () => {
    const r = await as()("activo", "Topic")
    assert.match(r.stderr, /warning: 'activo "<topic>"' is the old interface/)
    assert.equal(task("a", "Topic", "Topic").estado, "en_curso")
  })
})

describe("cartera.sh: list, rutina, describir", () => {
  it("list: ● for an open block, ✓ when all its tasks are finished, with the tasks under it", async () => {
    await as()("tarea", "Open", "t1", "en-curso", "--espera", "x")
    await as()("tarea", "Done", "t2", "terminado")
    const r = await as()("list")
    assert.equal(r.code, 0)
    assert.ok(r.stdout.includes("● Open\n    en_curso [espera: x]\tt1\n"))
    assert.ok(r.stdout.includes("✓ Done\n    terminado\tt2\n"))
  })

  it("list: '(no blocks)' when there is no file; routines shown on the last line", async () => {
    assert.equal((await as()("list")).stdout, "(no blocks)\n")
    await as()("rutina", "one pass a day")
    await as()("rutina", "another")
    assert.match((await as()("list")).stdout, /↻ rutinas: one pass a day · another\n$/)
    assert.equal((await as()("rutina", "--quitar", "another")).stdout, "a: routine removed · another\n")
    assert.deepEqual(read().rutinas.map(r => r.rutina), ["one pass a day"])
  })

  it("describir: block and task descriptions are stored, shown in list, and '' deletes them", async () => {
    await as()("tarea", "B1", "T1", "en-curso")
    assert.equal((await as()("describir", "B1", "what it is")).stdout, "a: description · B1\n")
    await as()("describir", "B1", "T1", "task detail")
    assert.equal(read().bloques[0].desc, "what it is")
    assert.equal(task("a", "B1", "T1").desc, "task detail")
    assert.match((await as()("list")).stdout, /\n.*what it is.*\n/)
    await as()("describir", "B1", "")
    assert.equal(read().bloques[0].desc, undefined)
  })

  it("describir: exit 1 for a missing block or task, exit 2 for the wrong number of arguments", async () => {
    await as()("tarea", "B1", "T1", "en-curso")
    assert.equal((await as()("describir", "nope", "x")).code, 1)
    assert.equal((await as()("describir", "B1", "nope", "x")).code, 1)
    assert.equal((await as()("describir", "B1")).code, 2)
  })
})

describe("cartera.sh: coordinator commands", () => {
  beforeEach(async () => { await as("worker")("tarea", "B1", "T1", "parqueada", "--espera", "later") })

  it("nota and prioridad: set, show, delete; exit 1 for a task that does not exist; exit 2 for a bad priority", async () => {
    assert.equal((await as("boss")("nota", "worker", "B1", "T1", "going fine")).stdout, "worker: note · B1 › T1 — going fine\n")
    assert.equal(task("worker", "B1", "T1").nota, "going fine")
    assert.equal((await as("boss")("prioridad", "worker", "B1", "T1", "alta")).stdout, "worker: priority · B1 › T1 · alta\n")
    assert.equal(task("worker", "B1", "T1").prioridad, "alta")
    await as("boss")("nota", "worker", "B1", "T1", "")
    await as("boss")("prioridad", "worker", "B1", "T1", "")
    assert.equal(task("worker", "B1", "T1").nota, undefined)
    assert.equal(task("worker", "B1", "T1").prioridad, undefined)
    assert.equal((await as("boss")("nota", "worker", "B1", "nope", "x")).code, 1)
    assert.equal((await as("boss")("nota", "nobody", "B1", "T1", "x")).code, 1)
    assert.equal((await as("boss")("prioridad", "worker", "B1", "T1", "urgent")).code, 2)
  })

  it("archivar hides a block from list without deleting it; a new task on it brings it back", async () => {
    assert.equal((await as("boss")("archivar", "worker", "B1")).stdout, "worker: archived · B1\n")
    assert.equal(read("worker").bloques[0].archivado, true)
    assert.equal((await as("worker")("list")).stdout.includes("B1"), false)
    await as("worker")("tarea", "B1", "T2", "en-curso")
    assert.equal(read("worker").bloques[0].archivado, undefined)
    assert.equal((await as("boss")("archivar", "worker", "nope")).code, 1)
  })

  it("quitar --duplicado-de hides a block and records which one stays; exit 1/2 on bad input", async () => {
    await as("worker")("tarea", "B2", "T", "en-curso")
    assert.equal((await as("worker")("quitar", "B1", "--duplicado-de", "B2")).stdout, "worker: removed · B1 (duplicate of B2)\n")
    const b1 = read("worker").bloques.find(b => b.bloque === "B1")
    assert.deepEqual([b1.archivado, b1.duplicadoDe], [true, "B2"])
    assert.equal((await as("worker")("quitar", "B1", "--duplicado-de", "B1")).code, 1)
    assert.equal((await as("worker")("quitar", "B2", "--duplicado-de", "B2")).code, 2)
    assert.equal((await as("worker")("quitar", "B2")).code, 2)
  })

  it("decision appends one JSON line to decisiones.jsonl in the state dir", async () => {
    const r = await as("boss")("decision", "topic", "we do X", "because Y", "revert Z")
    assert.equal(r.stdout, "decision recorded · topic\n")
    await as("boss")("decision", "other", "d", "w")
    const lines = readFileSync(join(env.state, "decisiones.jsonl"), "utf8").trim().split("\n").map(JSON.parse)
    assert.equal(lines.length, 2)
    assert.deepEqual([lines[0].de, lines[0].tema, lines[0].decision, lines[0].porque, lines[0].deshacer], ["boss", "topic", "we do X", "because Y", "revert Z"])
    assert.equal(lines[1].deshacer, undefined)
    assert.match(lines[0].ts, /^\d{4}-\d\d-\d\dT/)
  })
})

describe("cartera.sh: migrar, help, defaults", () => {
  it("migrar converts the old array format (activo -> en_curso, archivado -> archived block) and keeps a backup", async () => {
    mkdirp(dir)
    writeFileSync(join(dir, "old.json"), JSON.stringify([{tema: "T1", estado: "activo", at: 5}, {tema: "T2", estado: "archivado", at: 6, nota: "n"}]))
    const r = await as("x")("migrar")
    assert.match(r.stdout, /migrated: old\.json\nbackup in .*cartera-backup-v1\n$/)
    const m = read("old")
    assert.deepEqual(m.bloques.map(b => [b.bloque, b.tareas[0].estado, b.archivado ?? false]), [["T1", "en_curso", false], ["T2", "terminado", true]])
    assert.equal(m.bloques[1].tareas[0].nota, "n")
    assert.ok(readdirSync(join(env.state, "cartera-backup-v1")).includes("old.json"))
  })

  it("an old-format file also heals when any command reads it", async () => {
    mkdirp(dir)
    writeFileSync(join(dir, "a.json"), JSON.stringify([{tema: "T1", estado: "activo", at: 5}]))
    await as()("tarea", "T1", "extra", "en-curso")
    assert.equal(read().bloques[0].tareas.length, 2)
  })

  it("no arguments: header on stderr and exit 2; --help: header on stdout and exit 0", async () => {
    const none = await env.run(SCRIPT, [])
    assert.equal(none.code, 2)
    assert.match(none.stderr, /^cartera\.sh: a work board/)
    const help = await env.run(SCRIPT, ["--help"])
    assert.equal(help.code, 0)
    assert.match(help.stdout, /Exit:\s+0 done/)
  })

  it("CARTERA_DIR moves the files; with no override they live in <state-dir>/cartera", async () => {
    const other = join(env.root, "board")
    await env.run(SCRIPT, ["tarea", "B", "T", "en-curso"], {extraEnv: {CARTERA_SESION: "a", CARTERA_DIR: other}})
    assert.ok(existsSync(join(other, "a.json")))
    await as()("tarea", "B", "T", "en-curso")
    assert.ok(existsSync(join(env.state, "cartera", "a.json")))
  })
})

function mkdirp(d) {
  mkdirSync(d, {recursive: true})
}
