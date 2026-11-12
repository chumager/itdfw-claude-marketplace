// HTTP front of the runner. No dependencies of its own on purpose (only node:* and the local recipes): the same file runs as
// the live service and as the per-task dispatcher. States: registered -> running -> done | failed.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recipes, validateParams } from "./recipes/index.mjs";
import { JOBS_DIR } from "./paths.mjs";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const OCR_LANG = process.env.OCR_LANG || "eng";
const MAX_PROCS = Number(process.env.MAX_PROCS || 3);
const RUNNER = process.env.RUNNER || "inline";
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.mjs");

// inline: the live service calls query() itself (the SDK starts the `claude` child, cwd = job folder).
// spawn: one fresh `node worker.mjs <jobDir>` per job, which dies when the job ends.
const runners = {
  async inline(jobDir) {
    const { runJob } = await import("./run-job.mjs");
    await runJob(jobDir);
    return { code: 0, signal: null };
  },
  spawn(jobDir) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [WORKER, jobDir], {
        cwd: jobDir,
        stdio: ["ignore", "inherit", "inherit"],
        env: { PATH: process.env.PATH, HOME: process.env.HOME, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, CLAUDE_BIN: process.env.CLAUDE_BIN, AGENT_RUNNER_STATE: process.env.AGENT_RUNNER_STATE, JOBS_DIR: process.env.JOBS_DIR }
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => resolve({ code, signal }));
    });
  }
};
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json", ".jsonl": "application/x-ndjson", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".log": "text/plain; charset=utf-8" };

const jobs = new Map();
const queue = [];
let running = 0;

const jobPath = (id) => path.join(JOBS_DIR, id);
const outPath = (id) => path.join(jobPath(id), "out");

function persist(job) {
  fs.writeFileSync(path.join(jobPath(job.id), "meta.json"), JSON.stringify(job, null, 2));
}

const listDir = (id, sub) => {
  try {
    return fs
      .readdirSync(path.join(outPath(id), sub), { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => ({ name: path.posix.join(sub, e.name), size: fs.statSync(path.join(outPath(id), sub, e.name)).size }));
  } catch {
    return [];
  }
};

/** Files of a job: out/ and out/captures/ (names relative to out/, e.g. "captures/360.png"). */
function listFiles(id) {
  return [...listDir(id, ""), ...listDir(id, "captures").filter((f) => /\.(png|jpe?g)$/.test(f.name))];
}

function load(id) {
  if (jobs.has(id)) return jobs.get(id);
  try {
    return JSON.parse(fs.readFileSync(path.join(jobPath(id), "meta.json"), "utf8"));
  } catch {
    return null;
  }
}

function view(job) {
  const t = job.timing;
  const span = (a, b) => (t[a] && t[b] ? t[b] - t[a] : null);
  return {
    id: job.id,
    command: job.command,
    status: job.status,
    error: job.error ?? null,
    costUsd: job.costUsd ?? null,
    numTurns: job.numTurns ?? null,
    timing: { ...t, registeredToStartMs: span("registeredAt", "spawnedAt"), registeredToFirstMessageMs: span("registeredAt", "firstMessageAt"), registeredToDoneMs: span("registeredAt", "doneAt") },
    callback: job.callback ?? null,
    files: listFiles(job.id)
  };
}

async function sendCallback(job) {
  if (!job.callbackUrl) return;
  const body = JSON.stringify({ id: job.id, status: job.status, files: listFiles(job.id).map((f) => f.name) });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(job.callbackUrl, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(10_000) });
      job.callback = { url: job.callbackUrl, status: res.ok ? "ok" : "failed", httpStatus: res.status, attempt, at: Date.now() };
      if (res.ok) break;
    } catch (e) {
      job.callback = { url: job.callbackUrl, status: "failed", error: String(e.message), attempt, at: Date.now() };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  persist(job);
}

function finish(job, done, source) {
  if (job.finished) return;
  job.finished = true;
  job.timing.doneAt = Date.now();
  job.timing.doneSeenVia = source;
  job.timing.bootAt = done.bootAt ?? null;
  job.timing.firstMessageAt = done.firstMessageAt ?? null;
  job.timing.workerEndedAt = done.endedAt ?? null;
  job.status = done.status === "done" ? "done" : "failed";
  job.error = done.error ?? null;
  job.costUsd = done.sdk ? done.sdk.costUsd : (done.costUsd ?? 0);
  job.numTurns = done.sdk ? done.sdk.numTurns : null;
  persist(job);
  sendCallback(job);
}

function readDone(job) {
  try {
    return JSON.parse(fs.readFileSync(path.join(outPath(job.id), "done.json"), "utf8"));
  } catch {
    return null;
  }
}

function start(job) {
  running++;
  job.status = "running";
  job.timing.spawnedAt = Date.now();
  persist(job);
  // done.json is detected by inotify; the worker renames it into place so the event never shows a partial file.
  const watcher = fs.watch(outPath(job.id), (event, name) => {
    if (name !== "done.json") return;
    const done = readDone(job);
    if (done) finish(job, done, "fs.watch");
  });
  const release = () => {
    watcher.close();
    persist(job);
    running--;
    pump();
  };
  runners[RUNNER](jobPath(job.id)).then(
    ({ code, signal }) => {
      job.timing.exitedAt = Date.now();
      setTimeout(() => {
        if (!job.finished) {
          const done = readDone(job) || { id: job.id, status: "failed", error: `worker ended without done.json (code ${code}, signal ${signal})`, endedAt: Date.now() };
          finish(job, done, "exit");
        }
        release();
      }, 300);
    },
    (e) => {
      job.timing.exitedAt = Date.now();
      finish(job, { status: "failed", error: `cannot run worker: ${e.message}`, endedAt: Date.now() }, "runner-error");
      release();
    }
  );
}

function pump() {
  while (running < MAX_PROCS && queue.length) start(queue.shift());
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Validates the folder a job reads its photos from, without touching the job. Only regular files with an image extension
 * count (the rest, symbolic links and sub-folders included, is ignored); each one needs a safe name and at most 20 MB.
 * @param {string} inputDir Absolute path already accepted by validateParams.
 * @returns {{error: string}|{files: string[]}} the 400 message, or the accepted file names in name order.
 */
function scanInputDir(inputDir) {
  let entries;
  try {
    if (!fs.statSync(inputDir).isDirectory()) return { error: "inputDir is not a directory" };
    entries = fs.readdirSync(inputDir, { withFileTypes: true });
  } catch (e) {
    return { error: e.code === "ENOENT" ? "inputDir does not exist" : "inputDir cannot be read" };
  }
  const images = entries.filter((e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase())).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const { name } of images) {
    if (!FILE_RE.test(name)) return { error: `unsafe file name: ${JSON.stringify(name)} (letters, digits, "." "_" "-", starting with a letter or digit, up to 128 characters)` };
    if (fs.statSync(path.join(inputDir, name)).size > MAX_IMAGE_BYTES) return { error: `${name} is larger than 20 MB` };
  }
  if (!images.length) return { error: "inputDir has no images (.jpg, .jpeg, .png, .webp)" };
  if (images.length > MAX_IMAGES) return { error: `inputDir has ${images.length} images (max ${MAX_IMAGES})` };
  return { files: images.map((e) => e.name) };
}

/**
 * Copies the accepted images (real copies, never links) into `<job>/in/`, the only place the job can read them from.
 * @param {string} inputDir Source folder.
 * @param {string[]} files Names returned by scanInputDir.
 * @param {string} dest `<job>/in/`; it must not exist.
 * @returns {void}
 */
function copyInputs(inputDir, files, dest) {
  fs.mkdirSync(dest);
  for (const name of files) fs.copyFileSync(path.join(inputDir, name), path.join(dest, name), fs.constants.COPYFILE_EXCL);
}

const TARGET_TEXT_PX = 22;
const MIN_OCR_SCALE = 1.15;
const MAX_OCR_SCALE = 2.5;

/**
 * Median height in pixels of the words a tesseract TSV recognized with some confidence: how big the text of that photo is.
 * @param {string} tsvFile tesseract `tsv` output.
 * @returns {number} the median height, or Infinity when no word was recognized (no scaling then).
 */
function medianWordHeight(tsvFile) {
  const heights = fs.readFileSync(tsvFile, "utf8").split("\n").slice(1).map((line) => line.split("\t"))
    .filter((c) => c[0] === "5" && Number(c[10]) > 50 && (c[11] ?? "").trim().length > 2).map((c) => Number(c[9])).sort((a, b) => a - b);
  return heights.length ? heights[Math.floor(heights.length / 2)] : Infinity;
}

/**
 * Best-effort OCR of the copied images: for each `<name>` writes `<name>.ocr.txt` next to it with tesseract (language from OCR_LANG, default "eng"; automatic
 * page layout) at the photo's own size and, when its text is small, `<name>.ocr-scaled.txt` from a copy enlarged until its text is about
 * 22 px tall (the scale comes from the OCR's own measure, so it follows whatever size and orientation the photo has). Two readings
 * that disagree are information; neither is better by definition: more scale can read worse. So the agent can contrast its own reading with a reader that does not guess. A failure (no tesseract, a timeout)
 * leaves that file out and the job goes on without it; the prompt tells the agent a missing file means no OCR.
 * @param {string} dest `<job>/in/` already filled by copyInputs.
 * @param {string[]} files Image names.
 * @returns {Promise<string[]>} the names that got an OCR text file.
 */
async function ocrInputs(dest, files) {
  const done = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arp-ocr-"));
  const ocr = (image, out, configs) => execFileAsync("tesseract", [image, out, "-l", OCR_LANG, "--psm", "3", ...configs], { timeout: 60_000 });
  const keepText = (from, to) => {
    if (!fs.readFileSync(from, "utf8").trim()) return false;
    fs.copyFileSync(from, to);
    return true;
  };
  for (const name of files) {
    const base = path.join(dest, name);
    try {
      const native = path.join(tmp, `${name}.x1`);
      await ocr(base, native, ["txt", "tsv"]);
      if (!keepText(`${native}.txt`, `${base}.ocr.txt`)) continue;
      done.push(name);
      const scale = Math.min(MAX_OCR_SCALE, TARGET_TEXT_PX / medianWordHeight(`${native}.tsv`));
      if (!(scale >= MIN_OCR_SCALE)) continue;
      const big = path.join(tmp, `${name}.png`);
      await execFileAsync("magick", [base, "-filter", "Lanczos", "-resize", `${Math.round(scale * 100)}%`, big], { timeout: 60_000 });
      await ocr(big, path.join(tmp, `${name}.xs`), ["txt"]);
      keepText(path.join(tmp, `${name}.xs.txt`), `${base}.ocr-scaled.txt`);
    } catch (e) {
      console.error(`ocr failed for ${name}: ${e.message}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return done;
}

async function postJob(req, res) {
  if (!/^application\/json\s*(;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "content-type must be application/json" });
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "body must be JSON (max 64 KB)" });
  }
  const { id, command, params, callbackUrl } = body ?? {};
  if (typeof id !== "string" || !ID_RE.test(id)) return json(res, 400, { error: "id must match [A-Za-z0-9_-]{1,64}" });
  const recipe = typeof command === "string" && Object.hasOwn(recipes, command) ? recipes[command] : null;
  if (!recipe) return json(res, 400, { error: `unknown command: ${command}`, commands: Object.keys(recipes) });
  const bad = validateParams(recipe, params);
  if (bad) return json(res, 400, { error: bad });
  if (callbackUrl !== undefined && !(typeof callbackUrl === "string" && /^https?:\/\//.test(callbackUrl))) return json(res, 400, { error: "callbackUrl must be an http(s) URL" });
  if (load(id)) return json(res, 409, { error: "id already exists" });

  let input = null;
  if (Object.hasOwn(recipe.params, "inputDir")) {
    const scan = scanInputDir(params.inputDir);
    if (scan.error) return json(res, 400, { error: scan.error });
    input = { dir: params.inputDir, count: scan.files.length, files: scan.files };
  }

  const job = { id, command, status: "registered", callbackUrl: callbackUrl ?? null, ...(input && { input }), timing: { registeredAt: Date.now() } };
  fs.mkdirSync(outPath(id), { recursive: true });
  if (input) {
    try {
      copyInputs(input.dir, input.files, path.join(jobPath(id), "in"));
      if (recipe.ocr) input.ocr = await ocrInputs(path.join(jobPath(id), "in"), input.files);
    } catch (e) {
      console.error(e);
      fs.rmSync(jobPath(id), { recursive: true, force: true });
      return json(res, 500, { error: "could not copy the images" });
    }
  }
  fs.writeFileSync(path.join(jobPath(id), "job.json"), JSON.stringify({ id, command, params: params ?? {} }, null, 2));
  jobs.set(id, job);
  persist(job);
  queue.push(job);
  json(res, 202, { id, status: "registered" });
  pump();
}

function getFile(res, id, name) {
  if (!name.split("/").every((part) => FILE_RE.test(part)) || name.split("/").length > 2) return json(res, 400, { error: "bad file name" });
  const file = path.join(outPath(id), name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { error: "no such file" });
  res.writeHead(200, { "content-type": TYPES[path.extname(name)] || "application/octet-stream", "content-length": fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://x");
    if (req.method === "GET" && pathname === "/health") return json(res, 200, { ok: true, runner: RUNNER, pid: process.pid, maxProcs: MAX_PROCS, running, queued: queue.length });
    if (req.method === "POST" && pathname === "/jobs") return await postJob(req, res);
    const m = pathname.match(/^\/jobs\/([^/]+)(?:\/files\/(.+))?$/);
    if (req.method === "GET" && m) {
      if (!ID_RE.test(m[1])) return json(res, 400, { error: "bad id" });
      const job = load(m[1]);
      if (!job) return json(res, 404, { error: "no such job" });
      return m[2] ? getFile(res, m[1], m[2]) : json(res, 200, view(job));
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "internal error" });
  }
});

fs.mkdirSync(JOBS_DIR, { recursive: true });
// The live service pays the SDK import once at boot; per-task mode pays it in every worker.
if (RUNNER === "inline") await import("@anthropic-ai/claude-agent-sdk");
server.listen(PORT, HOST, () => console.log(`agent-runner listening on ${HOST}:${PORT} runner=${RUNNER} maxProcs=${MAX_PROCS} jobs=${JOBS_DIR}`));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close();
    setTimeout(() => process.exit(0), 300);
  });
}
