// Shared by the HTTP tests: starts src/server.mjs on a free port with a temporary state folder, no API key and no model.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/**
 * Sends one HTTP request and parses the JSON answer (or keeps the text when it is not JSON).
 * @param {number} port Service port on 127.0.0.1.
 * @param {string} method HTTP method.
 * @param {string} p Path.
 * @param {unknown} [body] Object sent as JSON; a string is sent as is.
 * @param {object} [headers] Extra headers (a content-type here replaces the JSON one).
 * @returns {Promise<{status: number, body: any, text: string}>} status plus the parsed body (null when empty or not JSON).
 */
export function request(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
    const h = data === null ? headers : { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...headers };
    const r = http.request({ host: "127.0.0.1", port, path: p, method, headers: h }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* not JSON */
        }
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    r.on("error", reject);
    r.end(data);
  });
}

/**
 * Starts the service in a temporary folder and waits until /health answers.
 * @param {{runner?: "inline"|"spawn", maxProcs?: number}} [options] Runner mode (default spawn) and queue width (default 0: nothing starts).
 * @returns {Promise<{port: number, tmp: string, jobsDir: string, get: Function, post: Function, stop: Function}>} handle; `stop` kills the service and deletes the folder.
 */
export async function startService({ runner = "spawn", maxProcs = 0 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-runner-test-"));
  const jobsDir = path.join(tmp, "jobs");
  const port = await freePort();
  const env = { PATH: process.env.PATH, HOME: os.homedir(), PORT: String(port), RUNNER: runner, MAX_PROCS: String(maxProcs), AGENT_RUNNER_STATE: tmp, JOBS_DIR: jobsDir };
  const service = spawn(process.execPath, [path.join(ROOT, "src/server.mjs")], { stdio: ["ignore", "ignore", "inherit"], env });
  let up = false;
  for (let i = 0; i < 200 && !up; i++) {
    if (service.exitCode !== null) throw new Error("service died at boot");
    try {
      up = (await request(port, "GET", "/health")).status === 200;
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  if (!up) throw new Error("service did not come up");
  return {
    port,
    tmp,
    jobsDir,
    get: (p) => request(port, "GET", p),
    post: (p, body, headers) => request(port, "POST", p, body, headers),
    stop: async () => {
      if (service.exitCode === null) {
        service.kill("SIGTERM");
        await new Promise((r) => service.on("exit", r));
      }
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  };
}

/**
 * Polls GET /jobs/:id until its status is one of `states`.
 * @param {{get: Function}} svc Handle from startService.
 * @param {string} id Job id.
 * @param {string[]} [states] Statuses to wait for (default done or failed).
 * @param {number} [timeoutMs] Give up after this long.
 * @returns {Promise<object>} the job view that reached one of the states.
 */
export async function waitFor(svc, id, states = ["done", "failed"], timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const view = (await svc.get(`/jobs/${id}`)).body;
    if (view && states.includes(view.status)) return view;
    if (Date.now() > end) throw new Error(`job ${id} did not reach ${states.join("|")} (last: ${view && view.status})`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
