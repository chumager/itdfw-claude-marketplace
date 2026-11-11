/**
 * The package's source text stays generic.
 *
 * WHAT IT PROVES: no file under `src/` names a customer, a model of a deployment, a connection of ours, a numbered
 * internal finding or an internal role. The tool descriptions are read by the model of whoever installs the package, so
 * they carry generic examples (`Order`, `Customer`, `site-a`).
 *
 * The forbidden words are stored reversed so that this file does not contain them either.
 *
 * Run: node --test "test/*.test.js"
 */
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";
import {describe, it} from "node:test";
import {SRC} from "./lib.js";

const reversed = word => [...word].reverse().join("");
const FORBIDDEN = [
  ...["rebmeM", "noicalumiS", "tnemtsevnI", "adagaP", "rotsevni", "soicos", "oticarjac", "savitarepooc"].map(
    word => new RegExp(`\\b${reversed(word)}`, "i")
  ),
  new RegExp(`\\b${reversed("bal")}\\b`, "i"),
  new RegExp(`${reversed("nuS")}\\s+${reversed("uzT")}`, "i"),
  new RegExp(`${reversed("ogzallah")}\\s*#?\\d+|${reversed("gnidnif")}\\s*#\\d+`, "i")
];

describe("source text", () => {
  for (const file of readdirSync(SRC).filter(f => f.endsWith(".js"))) {
    it(`${file} has no internal vocabulary`, () => {
      const hits = readFileSync(join(SRC, file), "utf8")
        .split("\n")
        .flatMap((line, i) => FORBIDDEN.filter(re => re.test(line)).map(re => `line ${i + 1}: ${re}`));
      assert.deepEqual(hits, []);
    });
  }
});
