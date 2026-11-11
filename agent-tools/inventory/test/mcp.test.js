import {test} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {cpSync, mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP = join(HERE, "..", "mcp.mjs");

/** Starts the server in `cwd`, sends the requests one by one and returns the responses by id. */
async function converse(cwd, requests) {
  const child = spawn(process.execPath, [MCP], {cwd, stdio: ["pipe", "pipe", "inherit"], env: {...process.env, INVENTORY_CONFIG: ""}});
  const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
  const out = {};
  for (const req of requests) {
    child.stdin.write(`${JSON.stringify({jsonrpc: "2.0", ...req})}\n`);
    if (req.id != null) out[req.id] = JSON.parse((await lines.next()).value);
  }
  child.kill();
  return out;
}
const fixtureCopy = () => {
  const dir = mkdtempSync(join(tmpdir(), "inv-mcp-"));
  cpSync(join(HERE, "fixture"), dir, {recursive: true});
  return dir;
};
const init = {id: 1, method: "initialize", params: {protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {name: "t", version: "0"}}};

test("initialize and tools/list answer, and every tool accepts a jq filter", async () => {
  const r = await converse(fixtureCopy(), [init, {method: "notifications/initialized"}, {id: 2, method: "tools/list", params: {}}]);
  assert.equal(r[1].result.serverInfo.name, "itdfw-inventory");
  const names = r[2].result.tools.map(t => t.name);
  assert.deepEqual(names, ["affected", "branch", "callers", "hasCaller", "orphans", "summary"]);
  for (const t of r[2].result.tools) assert.equal(t.inputSchema.properties.jq.type, "string");
});

test("a tool call scans the config in the server's working directory", async () => {
  const r = await converse(fixtureCopy(), [init, {id: 2, method: "tools/call", params: {name: "hasCaller", arguments: {slot: "ItdBase"}}}]);
  assert.equal(JSON.parse(r[2].result.content[0].text).hasCaller, true);
});

test("the jq filter reshapes the result", async () => {
  const r = await converse(fixtureCopy(), [
    init,
    {id: 2, method: "tools/call", params: {name: "affected", arguments: {slot: "ItdBase", jq: ".descendants | length"}}}
  ]);
  assert.equal(r[2].result.content[0].text, "2");
});

test("without a config the tool call fails with the scanner's own message", async () => {
  const r = await converse(mkdtempSync(join(tmpdir(), "inv-mcp-none-")), [init, {id: 2, method: "tools/call", params: {name: "summary", arguments: {}}}]);
  assert.equal(r[2].result.isError, true);
  assert.match(r[2].result.content[0].text, /^inventory\.config\.json not found in /);
});
