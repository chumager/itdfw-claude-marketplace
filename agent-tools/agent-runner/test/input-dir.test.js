// Contract of the `inputDir` step of POST /jobs (recipe extractMenuImages). No model and no API key: the service runs
// with MAX_PROCS=0, so an accepted job stays "registered" and nothing starts.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startService } from "./harness.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arp-input-"));
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
let svc;
let jobsDir;
let n = 0;

const folder = (files) => {
  const dir = path.join(tmp, `in-${++n}`);
  fs.mkdirSync(dir);
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
};
const submit = (inputDir, extra = {}) => svc.post("/jobs", { id: `t${++n}`, command: "extractMenuImages", params: { name: "Test", inputDir, ...extra } });

before(async () => {
  svc = await startService({ runner: "spawn", maxProcs: 0 });
  jobsDir = svc.jobsDir;
});

after(async () => {
  await svc.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("a valid folder: 202, only the images are copied (sorted, as files), meta.json says how many and which", async () => {
  const dir = folder({ "b.png": png, "a.JPG": png, "c.webp": png, "d.jpeg": png, "notes.txt": "x", "e.gif": png });
  fs.mkdirSync(path.join(dir, "sub.png"));
  const target = path.join(tmp, "link-target.txt");
  fs.writeFileSync(target, "x");
  fs.symlinkSync(target, path.join(dir, "link.png"));
  const res = await submit(dir);
  assert.equal(res.status, 202);
  assert.equal(res.body.status, "registered");
  const jobDir = path.join(jobsDir, `t${n}`);
  assert.deepEqual(fs.readdirSync(path.join(jobDir, "in")).sort(), ["a.JPG", "b.png", "c.webp", "d.jpeg"]);
  for (const name of fs.readdirSync(path.join(jobDir, "in"))) {
    const st = fs.lstatSync(path.join(jobDir, "in", name));
    assert.ok(st.isFile() && !st.isSymbolicLink(), `${name} must be a regular file`);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(jobDir, "meta.json"), "utf8"));
  assert.deepEqual(meta.input, { dir, count: 4, files: ["a.JPG", "b.png", "c.webp", "d.jpeg"] });
});

test("the copy is a copy: changing the source afterwards does not touch the job's file", async () => {
  const dir = folder({ "one.png": png });
  assert.equal((await submit(dir)).status, 202);
  fs.writeFileSync(path.join(dir, "one.png"), "changed");
  assert.deepEqual(fs.readFileSync(path.join(jobsDir, `t${n}`, "in", "one.png")), png);
});

test("400: the folder does not exist, and a refused job leaves no folder", async () => {
  const res = await submit(path.join(tmp, "nope"));
  assert.equal(res.status, 400);
  assert.match(res.body.error, /inputDir.*does not exist/);
  assert.equal(fs.existsSync(path.join(jobsDir, `t${n}`)), false);
});

test("400: inputDir is a file, not a directory", async () => {
  const dir = folder({ "x.png": png });
  const res = await submit(path.join(dir, "x.png"));
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not a directory/);
});

test("400: inputDir is relative, or walks up with ..", async () => {
  for (const bad of ["relative/dir", "./x", `${tmp}/../etc`]) {
    const res = await submit(bad);
    assert.equal(res.status, 400, bad);
    assert.match(res.body.error, /absolute path/);
  }
});

test("400: the folder has no valid images (other files are ignored, not counted)", async () => {
  const res = await submit(folder({ "notes.txt": "x", "pic.gif": png }));
  assert.equal(res.status, 400);
  assert.match(res.body.error, /no images/);
});

test("400: more than 20 images", async () => {
  const files = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`p${String(i).padStart(2, "0")}.png`, png]));
  const res = await submit(folder(files));
  assert.equal(res.status, 400);
  assert.match(res.body.error, /21.*max 20/);
});

test("exactly 20 images is accepted", async () => {
  const files = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${String(i).padStart(2, "0")}.png`, png]));
  assert.equal((await submit(folder(files))).status, 202);
});

test("400: an image over 20 MB, naming it", async () => {
  const dir = folder({ "ok.png": png, "huge.png": png });
  fs.truncateSync(path.join(dir, "huge.png"), 20 * 1024 * 1024 + 1);
  const res = await submit(dir);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /huge\.png.*20 MB/);
});

test("an image of exactly 20 MB is accepted", async () => {
  const dir = folder({ "edge.png": png });
  fs.truncateSync(path.join(dir, "edge.png"), 20 * 1024 * 1024);
  assert.equal((await submit(dir)).status, 202);
});

test("400: an unsafe file name, naming it", async () => {
  for (const bad of ["with space.png", "-dash.png", ".hidden.png", "tilde~.png"]) {
    const res = await submit(folder({ "ok.png": png, [bad]: png }));
    assert.equal(res.status, 400, bad);
    assert.match(res.body.error, /unsafe file name/);
  }
});

test("400: an unknown param, and a missing inputDir, still go through validateParams", async () => {
  assert.equal((await svc.post("/jobs", { id: `u${++n}`, command: "extractMenuImages", params: { name: "T" } })).status, 400);
  assert.equal((await submit(folder({ "a.png": png }), { url: "https://example.com" })).status, 400);
});

test("OCR is best effort: an image the OCR cannot read does not fail the job; no .ocr.txt is left and meta.input.ocr is empty", async () => {
  const dir = folder({ "bad.png": png });
  const res = await svc.post("/jobs", { id: `v${++n}`, command: "extractMenuImagesV3", params: { name: "Test", inputDir: dir } });
  assert.equal(res.status, 202);
  const jobDir = path.join(jobsDir, `v${n}`);
  assert.deepEqual(fs.readdirSync(path.join(jobDir, "in")), ["bad.png"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(jobDir, "meta.json"), "utf8")).input.ocr, []);
});

test("a recipe without inputDir (selfTest) needs none and gets no in/ folder", async () => {
  assert.equal((await svc.post("/jobs", { id: `s${++n}`, command: "selfTest", params: { sleepMs: 10 } })).status, 202);
  assert.equal(fs.existsSync(path.join(jobsDir, `s${n}`, "in")), false);
});
