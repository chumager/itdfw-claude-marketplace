/**
 * `reindex` and its command line.
 *
 * WHAT IT PROVES:
 *  - the graph to index can be given as an argument (function and command line) or by `GRAPH_JSON`, and the
 *    `.index-meta.json` of that run is written next to THAT graph;
 *  - the call that empties the collection carries the `api-key` header, like every other call to the vector database;
 *  - the command line prints the number of nodes indexed, not an object.
 *
 * The graphs here hold no node of an indexed type, so nothing is embedded: the suite needs no embedding service, only a
 * local listener that answers like the vector database.
 *
 * Run: node --test "test/*.test.js"
 */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {after, before, describe, it} from "node:test";
import {SRC, fakeQdrant} from "./lib.js";

const run = promisify(execFile);
const KEY = "test-key-not-a-secret";
const dir = mkdtempSync(join(tmpdir(), "graph-rag-reindex-"));
let qdrant;

/** Writes a graph with one node of a type that is not indexed, so a run has nothing to embed. */
function writeGraph(name) {
  const folder = join(dir, name);
  mkdirSync(folder, {recursive: true});
  const file = join(folder, "graph.json");
  writeFileSync(file, JSON.stringify({built_at_commit: "abc123def456", nodes: [{label: "a file", file_type: "code", source_file: "a.js"}]}));
  return file;
}

/** Runs the command line in an empty working directory, so a default relative path cannot resolve by accident. */
const cli = (args, env = {}) =>
  run(process.execPath, [`${SRC}reindex.js`, ...args], {
    cwd: dir,
    env: {PATH: process.env.PATH, QDRANT_URL: qdrant.url, QDRANT_API_KEY: KEY, ...env}
  });

before(async () => {
  qdrant = await fakeQdrant();
});
after(async () => {
  await qdrant.close();
  rmSync(dir, {recursive: true, force: true});
});

describe("graph location", () => {
  it("writes .index-meta.json next to the graph given as a command line argument", async () => {
    const graph = writeGraph("by-argument");
    await cli([graph]);
    const meta = JSON.parse(readFileSync(join(dir, "by-argument", ".index-meta.json"), "utf8"));
    assert.equal(meta.count, 0);
    assert.equal(meta.commit, "abc123def456");
  });

  it("writes .index-meta.json next to the graph given by GRAPH_JSON", async () => {
    const graph = writeGraph("by-env");
    await cli([], {GRAPH_JSON: graph});
    assert.equal(existsSync(join(dir, "by-env", ".index-meta.json")), true);
  });

  it("takes the graph from the argument of reindex() and writes the meta next to it", async () => {
    const graph = writeGraph("by-function");
    const code = `import {reindex} from ${JSON.stringify(`${SRC}index.js`)}; console.log(JSON.stringify(await reindex({graph: process.argv[1]})));`;
    const {stdout} = await run(process.execPath, ["--input-type=module", "-e", code, graph], {
      cwd: dir,
      env: {PATH: process.env.PATH, QDRANT_URL: qdrant.url}
    });
    assert.deepEqual(JSON.parse(stdout), {count: 0, commit: "abc123def456"});
    assert.equal(existsSync(join(dir, "by-function", ".index-meta.json")), true);
  });
});

describe("defects", () => {
  it("sends the api-key header on the call that empties the collection", async () => {
    qdrant.requests.length = 0;
    await cli([], {GRAPH_JSON: writeGraph("api-key")});
    const del = qdrant.requests.find(r => r.method === "DELETE");
    assert.ok(del, "the collection was not emptied");
    assert.equal(del.headers["api-key"], KEY);
  });

  it("prints the number of nodes indexed, not an object", async () => {
    const {stdout} = await cli([], {GRAPH_JSON: writeGraph("printed")});
    assert.match(stdout, /listo: 0 nodos indexados/);
    assert.doesNotMatch(stdout, /\[object Object\]/);
  });
});
