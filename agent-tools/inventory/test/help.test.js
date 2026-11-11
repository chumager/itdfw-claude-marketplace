import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {existsSync, mkdtempSync, readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const SCAN = join(dirname(fileURLToPath(import.meta.url)), "..", "scan.mjs");

for (const flag of ["--help", "-h", "help"]) {
  test(`${flag} prints the usage and writes nothing, even without a config`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "inv-help-"));
    const run = spawnSync(process.execPath, [SCAN, flag], {cwd, encoding: "utf8"});
    assert.equal(run.status, 0);
    assert.match(run.stdout, /affected/);
    assert.equal(existsSync(join(cwd, "inventory.json")), false, "a help request must not write the inventory");
    assert.deepEqual(readdirSync(cwd), []);
  });
}
