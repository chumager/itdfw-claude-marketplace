// SPENDS MONEY (real model calls); key from ANTHROPIC_API_KEY. Linux only (samples /proc). Options: see the usage line below and README.md.
// Starts its own service and runs jobs in groups of --concurrency; a spend ledger in RESULTS_DIR stops it at --cap USD.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validate, DEFAULT_REFERENCE } from "./validate.mjs";
import { JOBS_DIR, RESULTS_DIR } from "./src/paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.join(RESULTS_DIR, "ledger.json");
const TICKS = 100;
const SAMPLE_MS = 500;
const API_ERROR = /\b(429|529)\b|rate.?limit|overloaded/i;

const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
if (!["inline", "spawn"].includes(mode)) {
  console.error("usage: node bench.mjs <inline|spawn> [--label L] [--command C] [--runs N] [--concurrency K] [--reserve USD] [--cap USD] [--ref F] [--input-dir D] [--name N] [--params JSON]");
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required");
  process.exit(2);
}
const runs = Number(flag("runs", 3));
const concurrency = Number(flag("concurrency", 1));
const label = flag("label", "b");
const command = flag("command", "extractMenuImages");
const ref = flag("ref", DEFAULT_REFERENCE);
const params = flag("params", undefined) ? JSON.parse(flag("params")) : { name: flag("name", "Sample Cafe"), inputDir: path.resolve(flag("input-dir", path.join(HERE, "fixtures/menu-in"))) };
const reserve = Number(flag("reserve", 0.6));
const globalCapUsd = Number(flag("cap", 2));
const PORT = 18000 + Math.floor(Math.random() * 1000);

const ledger = () => (fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { totalUsd: 0, runs: [] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const req = (method, p, body) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method, headers: data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {} }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    r.on("error", reject);
    r.end(data);
  });

function procTable() {
  const table = new Map();
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const raw = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      const comm = raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")"));
      const f = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
      table.set(Number(pid), { pid: Number(pid), comm, ppid: Number(f[1]), cpu: Number(f[11]) + Number(f[12]), childCpu: Number(f[13]) + Number(f[14]), rssKb: Number(f[21]) * 4 });
    } catch {
      /* process vanished between readdir and read */
    }
  }
  return table;
}

function sample(rootPid) {
  const table = procTable();
  const children = new Map();
  for (const p of table.values()) children.set(p.ppid, [...(children.get(p.ppid) || []), p]);
  const tree = [];
  const walk = (pid) => {
    for (const p of children.get(pid) || []) (tree.push(p), walk(p.pid));
  };
  walk(rootPid);
  const self = table.get(rootPid);
  return {
    t: Date.now(),
    svcKb: self ? self.rssKb : 0,
    descKb: tree.reduce((s, p) => s + p.rssKb, 0),
    descProcs: tree.length,
    cpuTicks: self ? self.cpu + self.childCpu : 0
  };
}

async function main() {
  const callbacks = new Map();
  const cbServer = http.createServer((rq, rs) => {
    let b = "";
    rq.on("data", (c) => (b += c));
    rq.on("end", () => {
      const j = JSON.parse(b);
      callbacks.set(j.id, { at: Date.now(), body: j });
      rs.end("ok");
    });
  });
  await new Promise((r) => cbServer.listen(0, "127.0.0.1", r));
  const cbUrl = `http://127.0.0.1:${cbServer.address().port}/cb`;

  const upStart = Date.now();
  const service = spawn(process.execPath, [path.join(HERE, "src/server.mjs")], {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, PORT: String(PORT), RUNNER: mode, MAX_PROCS: String(flag("max-procs", 3)), JOBS_DIR }
  });
  let upMs = null;
  while (upMs === null) {
    if (service.exitCode !== null) throw new Error("service died at boot");
    try {
      if ((await req("GET", "/health")).status === 200) upMs = Date.now() - upStart;
    } catch {
      await sleep(20);
    }
  }
  const idleKb = sample(service.pid).svcKb;

  const allSamples = [];
  const sampler = setInterval(() => allSamples.push(sample(service.pid)), SAMPLE_MS);
  const rows = [];
  let stopped = null;
  try {
    for (let first = 1; first <= runs; first += concurrency) {
      const ids = [];
      for (let i = first; i < first + concurrency && i <= runs; i++) ids.push(`${label}-${mode}-${i}`);
      const spent = ledger().totalUsd;
      if (spent + reserve * ids.length > globalCapUsd) {
        stopped = `spend cap: spent ${spent.toFixed(2)} + reserved ${(reserve * ids.length).toFixed(2)} > ${globalCapUsd}`;
        break;
      }
      const before = sample(service.pid);
      const t0 = Date.now();
      const posts = await Promise.all(ids.map(async (id) => ({ id, ...(await req("POST", "/jobs", { id, command, params, callbackUrl: cbUrl })), ackMs: Date.now() - t0 })));
      const views = new Map();
      while (views.size < ids.length) {
        await sleep(500);
        for (const id of ids) {
          if (views.has(id)) continue;
          const v = JSON.parse((await req("GET", `/jobs/${id}`)).body);
          if (v.status === "done" || v.status === "failed") views.set(id, v);
        }
      }
      const doneAt = Math.max(...[...views.values()].map((v) => v.timing.doneAt));
      for (let waited = 0; waited < 20000; waited += 250) {
        if (sample(service.pid).descProcs === 0) break;
        await sleep(250);
      }
      await sleep(SAMPLE_MS + 100);
      const after = sample(service.pid);
      const window = allSamples.filter((s) => s.t >= t0 - SAMPLE_MS);
      const wallS = (doneAt - t0) / 1000;
      const cpuS = (after.cpuTicks - before.cpuTicks) / TICKS;
      const mb = (kb) => +(kb / 1024).toFixed(1);
      const resources = {
        samples: window.length,
        svcRssPeakMB: mb(Math.max(...window.map((s) => s.svcKb))),
        descendantsRssPeakMB: mb(Math.max(...window.map((s) => s.descKb))),
        totalRssPeakMB: mb(Math.max(...window.map((s) => s.svcKb + s.descKb))),
        cpuSeconds: +cpuS.toFixed(2),
        cpuAvgPercentOfOneCore: +((cpuS / wallS) * 100).toFixed(1)
      };

      for (const p of posts) {
        const id = p.id;
        const view = JSON.parse((await req("GET", `/jobs/${id}`)).body);
        const outDir = path.join(JOBS_DIR, id, "out");
        const done = JSON.parse(fs.readFileSync(path.join(outDir, "done.json"), "utf8"));
        const check = validate(outDir, ref);
        const stderr = fs.existsSync(path.join(outDir, "cli-stderr.log")) ? fs.readFileSync(path.join(outDir, "cli-stderr.log"), "utf8") : "";
        const apiErrors = (stderr.match(new RegExp(API_ERROR, "gi")) || []).length + (API_ERROR.test(view.error || "") ? 1 : 0);
        const t = view.timing;
        const ms = (n) => (Number.isFinite(n) ? n : null);
        const row = {
          id,
          group: ids,
          post: { status: p.status, body: JSON.parse(p.body), ackMs: p.ackMs },
          status: view.status,
          error: view.error,
          verdict: check.verdict,
          reasons: check.reasons,
          costUsd: view.costUsd,
          numTurns: view.numTurns,
          usage: done.sdk && { input: done.sdk.usage.input_tokens, output: done.sdk.usage.output_tokens, cacheRead: done.sdk.usage.cache_read_input_tokens, cacheWrite: done.sdk.usage.cache_creation_input_tokens },
          modelUsage: done.sdk && Object.fromEntries(Object.entries(done.sdk.modelUsage || {}).map(([m, u]) => [m, { in: u.inputTokens, out: u.outputTokens, usd: u.costUSD }])),
          toolCounts: done.toolCounts,
          apiErrors,
          timingMs: {
            registeredToSpawn: ms(t.spawnedAt - t.registeredAt),
            spawnToWorkerBoot: ms(t.bootAt - t.spawnedAt),
            spawnToFirstMessage: ms(t.firstMessageAt - t.spawnedAt),
            postToDone: ms(t.doneAt - t0),
            workerEndToDetected: ms(t.doneAt - t.workerEndedAt),
            doneToCallback: callbacks.has(id) ? callbacks.get(id).at - t.doneAt : null
          },
          doneSeenVia: t.doneSeenVia,
          resources: concurrency === 1 ? resources : { groupResources: true },
          files: view.files.map((f) => f.name),
          validation: { sections: check.sections, products: check.products, priceInDescription: check.priceInDescription ? check.priceInDescription.length : null, variants: check.variants, calls: check.calls, priceDiffsInformational: check.priceDiffsInformational }
        };
        rows.push(row);
        const l = ledger();
        l.totalUsd += row.costUsd || 0;
        l.runs.push({ id, usd: row.costUsd || 0, at: new Date().toISOString() });
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
        fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2));
        console.error(`[${id}] ${row.status} ${row.verdict} $${(row.costUsd || 0).toFixed(3)} ${((t.doneAt - t0) / 1000).toFixed(0)}s ledger=$${l.totalUsd.toFixed(2)}${row.reasons.length ? ` (${row.reasons.join("; ")})` : ""}`);
      }
    }
  } finally {
    clearInterval(sampler);
    const downStart = Date.now();
    service.kill("SIGTERM");
    await new Promise((r) => (service.exitCode !== null ? r() : service.on("exit", r)));
    var downMs = Date.now() - downStart;
    cbServer.close();
  }
  const out = { mode, label, command, concurrency, upToHealthMs: upMs, downMs, serviceIdleRssMB: +(idleKb / 1024).toFixed(1), stopped, ledgerUsd: +ledger().totalUsd.toFixed(3), rows };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, `${label}-${mode}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out, rows: rows.map((r) => ({ id: r.id, status: r.status, verdict: r.verdict, reasons: r.reasons, costUsd: r.costUsd, turns: r.numTurns, timingMs: r.timingMs, resources: r.resources })) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
