/**
 * The gaps feature (reportGap / gaps / closeGap) is opt-in.
 *
 * WHAT IT PROVES: without `GAPS_DB` the server exposes only find, reindex, status and start, refuses the gap tools, and
 * touches nothing on start (no request to the vector database, no database file). With `GAPS_DB` the three gap tools
 * appear, the file is created on the first call and not before, and a gap is recorded, reopened by a repeat and closed.
 *
 * Run: node --test "test/*.test.js"
 */
import assert from "node:assert/strict";
import {existsSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, before, describe, it} from "node:test";
import {fakeQdrant, startServer} from "./lib.js";

const dir = mkdtempSync(join(tmpdir(), "graph-rag-gaps-"));
const CORE = ["find", "reindex", "status", "start"];
const text = r => r.content.map(c => c.text).join("\n");
let qdrant;

before(async () => {
  qdrant = await fakeQdrant();
});
after(async () => {
  await qdrant.close();
  rmSync(dir, {recursive: true, force: true});
});

describe("without GAPS_DB", () => {
  it("lists only the four core tools and sends nothing to the vector database", async () => {
    const server = await startServer({QDRANT_URL: qdrant.url}, dir);
    try {
      assert.deepEqual((await server.tools()).sort(), [...CORE].sort());
    } finally {
      await server.close();
    }
    assert.deepEqual(qdrant.requests, []);
    assert.equal(existsSync(join(dir, ".gaps.db")), false);
  });

  it("refuses the gap tools", async () => {
    const server = await startServer({QDRANT_URL: qdrant.url}, dir);
    try {
      for (const name of ["gaps", "reportGap", "closeGap"]) {
        await assert.rejects(server.client.callTool({name, arguments: {need: "x", id: 1}}), /herramienta desconocida/, name);
      }
    } finally {
      await server.close();
    }
  });
});

describe("with GAPS_DB", () => {
  const file = join(dir, "gaps.sqlite");

  it("lists the gap tools and does not open the database until it is used", async () => {
    const server = await startServer({QDRANT_URL: qdrant.url, GAPS_DB: file}, dir);
    try {
      assert.deepEqual((await server.tools()).sort(), [...CORE, "reportGap", "gaps", "closeGap"].sort());
      assert.equal(existsSync(file), false, "the file must not exist after start");
    } finally {
      await server.close();
    }
  });

  it("records a gap, reopens it on a repeat and closes it", async () => {
    const server = await startServer({QDRANT_URL: qdrant.url, GAPS_DB: file}, dir);
    try {
      const call = (name, args) => server.client.callTool({name, arguments: args});
      assert.match(text(await call("reportGap", {need: "a need", queries: ["q1"]})), /Gap #1 registrado/);
      assert.equal(existsSync(file), true, "the first use creates the file");
      assert.match(text(await call("reportGap", {need: "a need", queries: ["q2"]})), /Gap #1 REINCIDENTE/);
      assert.match(text(await call("gaps", {})), /#1 \[open\].*a need/s);
      assert.match(text(await call("closeGap", {id: 1, resolution: "done"})), /Gap #1 resuelto/);
      assert.match(text(await call("gaps", {})), /sin gaps abiertos/);
      assert.match(text(await call("reportGap", {need: "a need"})), /Gap #1 REABIERTO/);
    } finally {
      await server.close();
    }
  });
});
