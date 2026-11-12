// The validator, the comparator, the param validation and the fixtures: pure functions over files, no service and no model.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validate, checkShape, DEFAULT_REFERENCE } from "../validate.mjs";
import { compare, distance, pairProducts } from "../compare-menu.mjs";
import { recipes, validateParams } from "../src/recipes/index.mjs";
import { ROOT } from "./harness.mjs";

const reference = () => JSON.parse(fs.readFileSync(DEFAULT_REFERENCE, "utf8"));

/** Writes a fake job output folder (done.json, menu.json, optional calls.jsonl) and returns its path. */
function outDir(menu, { status = "done", calls } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arp-validate-"));
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify({ status, error: null }));
  if (menu !== undefined) fs.writeFileSync(path.join(dir, "menu.json"), typeof menu === "string" ? menu : JSON.stringify(menu));
  if (calls) fs.writeFileSync(path.join(dir, "calls.jsonl"), calls.map((c) => JSON.stringify(c)).join("\n"));
  return dir;
}

const products = (menu) => menu.menus.flatMap((m) => m.sections.flatMap((s) => s.products));

describe("the synthetic fixture", () => {
  test("the photo is a PNG and the only file of the input folder", () => {
    const dir = path.join(ROOT, "fixtures/menu-in");
    assert.deepEqual(fs.readdirSync(dir), ["menu-1.png"]);
    assert.equal(fs.readFileSync(path.join(dir, "menu-1.png")).subarray(1, 4).toString(), "PNG");
  });

  test("the reference has the documented shape, 12 invented products, one with two labelled prices, all named SAMPLE", () => {
    const ref = reference();
    assert.deepEqual(checkShape(ref), []);
    const all = products(ref);
    assert.equal(all.length, 12);
    assert.equal(all.filter((p) => p.prices.length === 2 && p.prices.every((x) => x.label)).length, 1);
    assert.ok(all.every((p) => /SAMPLE/.test(p.name)));
  });

  test("the reference keeps the misprint that is printed in the photo", () => {
    assert.ok(products(reference()).some((p) => p.name === "SAMPLE DIHS 9"));
  });
});

describe("validate()", () => {
  test("the reference against itself: ok, every name found, no price difference", () => {
    const r = validate(outDir(reference()));
    assert.equal(r.verdict, "ok", r.reasons.join("; "));
    assert.equal(r.products.nameMatchRate, 1);
    assert.deepEqual(r.priceDiffsInformational, []);
    assert.equal(r.sections.matchedByName, 3);
  });

  test("a job that did not finish is a fail", () => {
    const r = validate(outDir(reference(), { status: "failed" }));
    assert.equal(r.verdict, "fail");
    assert.match(r.reasons[0], /job status failed/);
  });

  test("a menu.json that is not JSON, or has the wrong shape, is a fail", () => {
    assert.match(validate(outDir("{nope")).shape.problems[0], /unreadable/);
    const noSlug = reference();
    delete noSlug.menus[0].slug;
    const r = validate(outDir(noSlug));
    assert.equal(r.verdict, "fail");
    assert.ok(r.reasons.includes("menu.json invalid"));
  });

  test("a denied tool call is a fail", () => {
    const r = validate(outDir(reference(), { calls: [{ event: "tool_use", name: "Read" }, { event: "denied", name: "Bash" }] }));
    assert.equal(r.calls.denied, 1);
    assert.equal(r.verdict, "fail");
  });

  test("a price inside a description is a fail", () => {
    const m = reference();
    m.menus[0].sections[0].products[0].description = "Now only $4.500";
    const r = validate(outDir(m));
    assert.equal(r.verdict, "fail");
    assert.match(r.reasons.join(), /prices inside descriptions/);
  });

  test("a product with two prices that lost its labels is a fail", () => {
    const m = reference();
    const two = products(m).find((p) => p.prices.length === 2);
    two.prices.forEach((x) => (x.label = ""));
    assert.match(validate(outDir(m)).reasons.join(), /variants 0\/1/);
  });

  test("a dish split in two (one price each) is a fail: 13 products and the variants are gone", () => {
    const m = reference();
    const section = m.menus[0].sections[1];
    const i = section.products.findIndex((p) => p.prices.length === 2);
    const [small, large] = section.products[i].prices;
    section.products.splice(i, 1, { name: "SAMPLE DISH 8 SMALL", description: "", prices: [small] }, { name: "SAMPLE DISH 8 LARGE", description: "", prices: [large] });
    assert.equal(validate(outDir(m)).verdict, "fail");
  });

  test("a missing section (2 of 3 found) is a fail", () => {
    const m = reference();
    m.menus[0].sections.pop();
    assert.match(validate(outDir(m)).reasons.join(), /sections 2\/3/);
  });

  test("KNOWN LIMIT: a misspelled dish word does NOT fail the verdict; it shows only in nameMatchRate", () => {
    const m = reference();
    products(m)[0].name = "SAMPLE DISCH 1";
    const r = validate(outDir(m));
    assert.equal(r.verdict, "ok");
    assert.equal(r.products.nameMatchRate, +(11 / 12).toFixed(3));
  });

  test("a price misread on a paired product shows in priceDiffsInformational but is not part of the verdict either", () => {
    const m = reference();
    products(m)[1].prices[0].price = 5000;
    const r = validate(outDir(m));
    assert.equal(r.verdict, "ok");
    assert.equal(r.priceDiffsInformational.length, 1);
  });

  test("a case change and a missing accent mark still match by normalized name", () => {
    const m = reference();
    products(m)[0].name = "Sample Dish 1";
    products(m)[2].name = "SAMPLÉ DISH 3";
    assert.equal(validate(outDir(m)).products.nameMatchRate, 1);
  });
});

describe("compare-menu", () => {
  test("distance is the Levenshtein distance", () => {
    assert.equal(distance("kitten", "sitting"), 3);
    assert.equal(distance("", "abc"), 3);
    assert.equal(distance("same", "same"), 0);
  });

  test("pairProducts pairs by exact name, then normalized, then fuzzy; the rest is missing or extra", () => {
    const mk = (name) => ({ name, menu: "M", section: "S", prices: [] });
    const { pairs, missing, extra } = pairProducts([mk("Alpha"), mk("Beta Dish"), mk("Gamma Plate"), mk("Delta")], [mk("Alpha"), mk("BETA dish"), mk("Gama Plate"), mk("Zzzz")]);
    assert.deepEqual(pairs.map((p) => p.how).sort(), ["exact", "fuzzy", "norm"]);
    assert.deepEqual(missing.map((p) => p.name), ["Delta"]);
    assert.deepEqual(extra.map((p) => p.name), ["Zzzz"]);
  });

  test("compare() against the reference itself finds nothing; with a changed price and a misspelled word it finds exactly those", () => {
    const same = compare(outDir(reference()), DEFAULT_REFERENCE);
    assert.deepEqual([same.missing, same.extra, same.priceDiffs, same.textDiffs, same.paired], [[], [], [], [], 12]);
    const m = reference();
    products(m)[0].prices[0].price = 4900;
    products(m)[3].description = "Fourth made-up starter with a longer lin";
    const r = compare(outDir(m), DEFAULT_REFERENCE);
    assert.equal(r.priceDiffs.length, 1);
    assert.equal(r.textDiffs.length, 1);
    assert.equal(r.textDiffs[0].field, "description");
    assert.equal(r.textDiffs[0].distance, 1);
    assert.equal(r.paired, 12);
  });
});

describe("recipes and validateParams", () => {
  test("the registry has the photo recipes (v1 to v5, Sonnet, Opus) and selfTest, and nothing that needs a browser", () => {
    assert.deepEqual(Object.keys(recipes).sort(), ["extractMenuImages", "extractMenuImagesOpus", "extractMenuImagesSonnet", "extractMenuImagesV2", "extractMenuImagesV3", "extractMenuImagesV4", "extractMenuImagesV5", "selfTest"]);
  });

  test("the model recipes are the very same recipe with another model; only Opus raises the budget", () => {
    assert.equal(recipes.extractMenuImages.model, "claude-haiku-5-5");
    assert.equal(recipes.extractMenuImagesSonnet.model, "claude-sonnet-5-5");
    assert.equal(recipes.extractMenuImagesOpus.model, "claude-opus-5-5");
    assert.equal(recipes.extractMenuImagesSonnet.systemPrompt, recipes.extractMenuImages.systemPrompt);
    assert.equal(recipes.extractMenuImagesOpus.maxBudgetUsd, 1);
  });

  test("every sdk recipe keeps Bash, Glob, Grep and WebFetch out, and only v3 to v5 may use WebSearch", () => {
    for (const [name, r] of Object.entries(recipes).filter(([, x]) => x.kind === "sdk")) {
      for (const t of ["Bash", "Glob", "Grep", "WebFetch"]) assert.ok(r.disallowedTools.includes(t) && !r.tools.includes(t), `${name} ${t}`);
      assert.equal(r.tools.includes("WebSearch"), ["extractMenuImagesV3", "extractMenuImagesV4", "extractMenuImagesV5"].includes(name), name);
    }
  });

  test("absolutePath accepts an absolute path and rejects relative, '..' and NUL", () => {
    const r = recipes.extractMenuImages;
    assert.equal(validateParams(r, { name: "x", inputDir: "/a/b" }), null);
    for (const inputDir of ["a/b", "/a/../b", "/a\0b", 3]) assert.notEqual(validateParams(r, { name: "x", inputDir }), null, String(inputDir));
    assert.match(validateParams(r, { name: "", inputDir: "/a" }), /too short/);
  });
});
