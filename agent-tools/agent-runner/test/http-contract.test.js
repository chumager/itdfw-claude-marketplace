// HTTP contract of the service, driven with the selfTest recipe: it sleeps and writes a file, so no model and no API key.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { startService, waitFor, request } from "./harness.mjs";

const ok = (id, sleepMs = 0, extra = {}) => ({ id, command: "selfTest", params: { sleepMs }, ...extra });

/** A local server that records the callbacks the runner POSTs. */
function callbackSink() {
  const received = [];
  const server = http.createServer((rq, rs) => {
    let b = "";
    rq.on("data", (c) => (b += c));
    rq.on("end", () => {
      received.push(JSON.parse(b));
      rs.end("ok");
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ received, url: `http://127.0.0.1:${server.address().port}/cb`, close: () => server.close() })));
}

for (const runner of ["spawn", "inline"]) {
  describe(`runner=${runner}: a job goes registered -> running -> done`, () => {
    let svc;
    before(async () => {
      svc = await startService({ runner, maxProcs: 3 });
    });
    after(() => svc.stop());

    test("202 on accept with {id, status: registered}; the job finishes done with its files, cost 0 and a callback", async () => {
      const sink = await callbackSink();
      try {
        const res = await svc.post("/jobs", ok("a1", 50, { callbackUrl: sink.url }));
        assert.equal(res.status, 202);
        assert.deepEqual(res.body, { id: "a1", status: "registered" });
        const view = await waitFor(svc, "a1");
        assert.equal(view.status, "done");
        assert.equal(view.error, null);
        assert.equal(view.command, "selfTest");
        assert.equal(view.costUsd, 0);
        assert.deepEqual(view.files.map((f) => f.name).sort(), ["done.json", "hello.txt"]);
        assert.ok(view.timing.registeredToDoneMs >= 50);
        const file = await svc.get("/jobs/a1/files/hello.txt");
        assert.equal(file.status, 200);
        assert.equal(file.text, "hello\n");
        for (let i = 0; i < 100 && !sink.received.length; i++) await new Promise((r) => setTimeout(r, 20));
        assert.deepEqual(sink.received, [{ id: "a1", status: "done", files: view.files.map((f) => f.name) }]);
        assert.equal((await svc.get("/jobs/a1")).body.callback.status, "ok");
      } finally {
        sink.close();
      }
    });

    test("the job state survives in meta.json and a repeated id is a 409", async () => {
      assert.equal((await svc.post("/jobs", ok("a2"))).status, 202);
      await waitFor(svc, "a2");
      const meta = JSON.parse(fs.readFileSync(path.join(svc.jobsDir, "a2", "meta.json"), "utf8"));
      assert.equal(meta.status, "done");
      const again = await svc.post("/jobs", ok("a2"));
      assert.equal(again.status, 409);
      assert.match(again.body.error, /already exists/);
    });
  });
}

describe("the queue", () => {
  let svc;
  before(async () => {
    svc = await startService({ runner: "spawn", maxProcs: 1 });
  });
  after(() => svc.stop());

  test("with MAX_PROCS=1 the second job waits as registered while the first runs; both end done", async () => {
    assert.equal((await svc.post("/jobs", ok("q1", 600))).status, 202);
    assert.equal((await svc.post("/jobs", ok("q2", 0))).status, 202);
    await waitFor(svc, "q1", ["running"]);
    assert.equal((await svc.get("/jobs/q2")).body.status, "registered");
    const health = (await svc.get("/health")).body;
    assert.equal(health.running, 1);
    assert.equal(health.queued, 1);
    assert.equal((await waitFor(svc, "q1")).status, "done");
    assert.equal((await waitFor(svc, "q2")).status, "done");
    const [a, b] = [await svc.get("/jobs/q1"), await svc.get("/jobs/q2")];
    assert.ok(b.body.timing.spawnedAt >= a.body.timing.doneAt - 400, "q2 starts only after q1 is out of the slot");
  });
});

describe("input handling", () => {
  let svc;
  before(async () => {
    svc = await startService({ runner: "spawn", maxProcs: 0 });
  });
  after(() => svc.stop());

  test("GET /health answers ok with the runner and the queue numbers", async () => {
    const res = await svc.get("/health");
    assert.equal(res.status, 200);
    assert.deepEqual({ ok: res.body.ok, runner: res.body.runner, maxProcs: res.body.maxProcs, running: res.body.running, queued: res.body.queued }, { ok: true, runner: "spawn", maxProcs: 0, running: 0, queued: 0 });
  });

  test("415 when the content type is not application/json", async () => {
    const res = await request(svc.port, "POST", "/jobs", '{"id":"x"}', { "content-type": "text/plain", "content-length": "10" });
    assert.equal(res.status, 415);
  });

  test("400: the body is not JSON, or is larger than 64 KB", async () => {
    assert.equal((await svc.post("/jobs", "{nope")).status, 400);
    const big = await svc.post("/jobs", JSON.stringify({ id: "big", command: "selfTest", pad: "x".repeat(70000) }));
    assert.equal(big.status, 400);
    assert.match(big.body.error, /64 KB/);
  });

  test("400: the id must match [A-Za-z0-9_-]{1,64}", async () => {
    for (const id of ["", "a b", "../x", "x".repeat(65), 7, null]) assert.equal((await svc.post("/jobs", ok(id))).status, 400, JSON.stringify(id));
    assert.equal((await svc.post("/jobs", { command: "selfTest" })).status, 400);
  });

  test("400: an unknown command lists the known ones; inherited names like constructor are unknown too", async () => {
    for (const command of ["nope", "constructor", "__proto__", undefined, 3]) {
      const res = await svc.post("/jobs", { id: "c1", command });
      assert.equal(res.status, 400, String(command));
      if (typeof command === "string") assert.ok(res.body.commands.includes("selfTest") && res.body.commands.includes("extractMenuImages"));
    }
  });

  test("400: params must be an object with known keys of the right type and range", async () => {
    const bad = [["x"], 3, null, { sleepMs: "5" }, { sleepMs: 1.5 }, { sleepMs: -1 }, { sleepMs: 60001 }, { other: 1 }];
    for (const params of bad) {
      const res = await svc.post("/jobs", { id: "p1", command: "selfTest", params });
      assert.equal(res.status, 400, JSON.stringify(params));
    }
    assert.equal((await svc.post("/jobs", { id: "p2", command: "selfTest" })).status, 202, "params are optional for selfTest");
  });

  test("400: callbackUrl must be an http(s) URL", async () => {
    for (const callbackUrl of ["ftp://x", "not a url", 5]) assert.equal((await svc.post("/jobs", ok("cb", 0, { callbackUrl }))).status, 400, String(callbackUrl));
  });

  test("404 for an unknown job, an unknown file and an unknown route; 400 for a bad id or file name", async () => {
    assert.equal((await svc.get("/jobs/missing")).status, 404);
    assert.equal((await svc.get("/nothing")).status, 404);
    assert.equal((await svc.post("/jobs", ok("f1"))).status, 202);
    assert.equal((await svc.get("/jobs/f1/files/nope.txt")).status, 404);
    assert.equal((await svc.get("/jobs/f1/files/..%2Fmeta.json")).status, 400);
    assert.equal((await svc.get("/jobs/f1/files/a/b/c.txt")).status, 400);
    assert.equal((await svc.get("/jobs/bad%20id")).status, 400);
  });
});
