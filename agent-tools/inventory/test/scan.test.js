import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {cpSync, existsSync, mkdtempSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCAN = join(HERE, "..", "scan.mjs");

/** A fresh copy of the fixture project, so every case writes its inventory.json into a throwaway directory. */
const workdir = () => {
  const dir = mkdtempSync(join(tmpdir(), "inv-scan-"));
  cpSync(join(HERE, "fixture"), dir, {recursive: true});
  return dir;
};
const scan = (cwd, args = [], env = {}) =>
  spawnSync(process.execPath, [SCAN, ...args], {cwd, encoding: "utf8", env: {...process.env, INVENTORY_CONFIG: "", ...env}});

test("without a config it stops with a clear error, writes nothing and never falls back to a default", () => {
  const cwd = mkdtempSync(join(tmpdir(), "inv-none-"));
  const run = scan(cwd, ["orphans"]);
  assert.equal(run.status, 1);
  assert.equal(run.stderr.trim(), `inventory.config.json not found in ${cwd}`);
  assert.equal(existsSync(join(cwd, "inventory.json")), false);
});

test("INVENTORY_CONFIG names the config; the root is its folder and inventory.json lands there", () => {
  const dir = workdir();
  const elsewhere = mkdtempSync(join(tmpdir(), "inv-cwd-"));
  const run = scan(elsewhere, [], {INVENTORY_CONFIG: join(dir, "inventory.config.json")});
  assert.equal(run.status, 0, run.stderr);
  assert.equal(existsSync(join(dir, "inventory.json")), true);
  assert.equal(existsSync(join(elsewhere, "inventory.json")), false);
});

test("INVENTORY_CONFIG pointing at nothing is an error that names the path", () => {
  const cwd = mkdtempSync(join(tmpdir(), "inv-bad-"));
  const run = scan(cwd, [], {INVENTORY_CONFIG: join(cwd, "nope.json")});
  assert.equal(run.status, 1);
  assert.equal(run.stderr.trim(), `${join(cwd, "nope.json")} not found`);
});

test("summary counts the components of the front directories and the layers of the fixture", () => {
  const dir = workdir();
  const run = scan(dir);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.equal(out.components, 5);
  assert.deepEqual(out.scannedDirs, ["core front/src", "plugin:demo plugins/demo/vue"]);
  assert.deepEqual(out.callerDirs, ["back back", "plugin:demo plugins/demo"]);
  const inv = JSON.parse(readFileSync(join(dir, "inventory.json"), "utf8"));
  assert.deepEqual(Object.keys(inv.nodes).sort(), ["Host", "ItdBase", "ItdChild", "ItdLonely", "ItdPlug"]);
  assert.equal(inv.nodes.ItdPlug.instances[0].layer, "plugin:demo");
  assert.equal(inv.nodes.ItdBase.instances[0].file, "front/src/ItdBase.js", "paths are relative to the config folder");
});

test("affected lists the descendants by extends, the declared callers and the specs", () => {
  const out = JSON.parse(scan(workdir(), ["affected", "ItdBase"]).stdout);
  assert.deepEqual(out.descendants.sort(), ["ItdChild", "ItdPlug"]);
  assert.deepEqual(out.callers.declared, ["back back/schema.js"]);
  assert.deepEqual(out.specsBySlot.ItdBase, {"front/src/ItdBase.js": ["test/base.spec.js"]});
  assert.deepEqual(out.specsBySlot.ItdChild, {"front/src/ItdChild.js": []});
});

test("callers finds a declared use through the un-prefixed variant and a render use through localImport", () => {
  const out = JSON.parse(scan(workdir(), ["callers", "ItdChild"]).stdout);
  assert.deepEqual(out.declared, ["back back/schema.js"]);
  assert.deepEqual(out.render, ["core front/src/Host.js"]);
});

test("branch walks up the ancestors", () => {
  const out = JSON.parse(scan(workdir(), ["branch", "ItdChild"]).stdout);
  assert.deepEqual(out.ancestors, ["ItdBase"]);
});

test("orphans flags the components with no child, no declared use and no render use", () => {
  const out = JSON.parse(scan(workdir(), ["orphans"]).stdout);
  assert.deepEqual(out.orphans.sort(), ["Host", "ItdLonely", "ItdPlug"]);
});
