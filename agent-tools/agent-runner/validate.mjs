// Usage: node validate.mjs <job out dir> [reference menu.json]  (default: fixtures/menu-reference.json). Exit 0 when ok.
// Measures agreement between menu.json and a REFERENCE; it never looks at the photo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The invented reference that matches the synthetic fixture photo. */
export const DEFAULT_REFERENCE = path.join(HERE, "fixtures", "menu-reference.json");

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// A currency symbol, a thousands-separated number or a 4 to 6 digit number: it looks like a price.
const PRICE_IN_TEXT = /\$|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{4,6}\b/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Checks menu.json against the documented shape.
 * @param {unknown} menu Parsed menu.json.
 * @returns {string[]} problems found (empty when valid, at most 20).
 */
export function checkShape(menu) {
  const problems = [];
  const bad = (where, why) => problems.length < 20 && problems.push(`${where}: ${why}`);
  if (!menu || !Array.isArray(menu.menus) || !menu.menus.length) return ["menus must be a non-empty array"];
  menu.menus.forEach((m, mi) => {
    if (typeof m.name !== "string" || !m.name) bad(`menus[${mi}]`, "name");
    if (typeof m.slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug)) bad(`menus[${mi}]`, "slug");
    if (!Array.isArray(m.sections)) return bad(`menus[${mi}]`, "sections");
    m.sections.forEach((s, si) => {
      if (typeof s.name !== "string" || !s.name) bad(`menus[${mi}].sections[${si}]`, "name");
      if (!Array.isArray(s.products)) return bad(`menus[${mi}].sections[${si}]`, "products");
      s.products.forEach((p, pi) => {
        const at = `menus[${mi}].sections[${si}].products[${pi}]`;
        if (typeof p.name !== "string" || !p.name.trim()) bad(at, "name");
        if (p.description !== undefined && typeof p.description !== "string") bad(at, "description");
        if (!Array.isArray(p.prices)) return bad(at, "prices");
        p.prices.forEach((pr, pri) => {
          if (typeof pr.label !== "string") bad(`${at}.prices[${pri}]`, "label");
          if (!Number.isFinite(pr.price) || pr.price < 0) bad(`${at}.prices[${pri}]`, "price");
        });
      });
    });
  });
  return problems;
}

const flatten = (menu) => menu.menus.flatMap((m) => m.sections.map((s) => ({ ...s, menu: m.name })));

/**
 * Reads calls.jsonl (the tool-call log a job leaves) and counts denied calls and the most repeated error.
 * @param {string} file Path of calls.jsonl.
 * @returns {{available: boolean, denied: number, maxRepeatedError: number, toolCalls: object}} counts; `available` is false when the file is missing.
 */
export function checkCalls(file) {
  const out = { available: false, denied: 0, maxRepeatedError: 0, toolCalls: {} };
  if (!fs.existsSync(file)) return out;
  out.available = true;
  const errors = new Map();
  for (const line of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const l = JSON.parse(line);
    if (l.event === "denied") out.denied++;
    if (l.event === "tool_use") out.toolCalls[l.name] = (out.toolCalls[l.name] || 0) + 1;
    if (l.event === "tool_result" && l.is_error) {
      const key = `${l.name}|${(l.head || "").slice(0, 80)}`;
      errors.set(key, (errors.get(key) || 0) + 1);
    }
  }
  out.maxRepeatedError = Math.max(0, ...errors.values());
  return out;
}

/**
 * Validates one job output folder against a reference menu.
 * Verdict "ok" needs: the job finished, menu.json has the documented shape, no tool call was denied, at least 90 % of the
 * reference sections are found by (normalized) name, the product count is within 10 % of the reference, no price sits
 * inside a description (unless the reference does the same) and every multi-price reference product keeps labelled variants.
 * `nameMatchRate` (share of reference product names found, normalized) is reported but is NOT part of the verdict:
 * see RESULTS.md, it is the first thing that should be added.
 * @param {string} outDir The job's out/ folder.
 * @param {string} [refFile] Reference menu.json (same shape as the output); defaults to the synthetic fixture's.
 * @returns {object} All the numbers plus `verdict` ("ok" | "fail") and `reasons`.
 */
export function validate(outDir, refFile = DEFAULT_REFERENCE) {
  const r = { outDir, shape: { ok: false, problems: [] } };
  const done = fs.existsSync(path.join(outDir, "done.json")) ? readJson(path.join(outDir, "done.json")) : null;
  r.done = done && { status: done.status, error: done.error };
  r.calls = checkCalls(path.join(outDir, "calls.jsonl"));
  let menu = null;
  try {
    menu = readJson(path.join(outDir, "menu.json"));
    r.shape.problems = checkShape(menu);
  } catch (e) {
    r.shape.problems = [`menu.json unreadable: ${e.message}`];
  }
  r.shape.ok = r.shape.problems.length === 0;
  const reasons = [];
  if (!done || done.status !== "done") reasons.push(`job status ${done ? done.status : "no done.json"}`);
  if (!r.shape.ok) reasons.push("menu.json invalid");
  if (r.calls.denied > 0) reasons.push(`${r.calls.denied} denied tool calls`);
  if (r.shape.ok) {
    const ref = readJson(refFile);
    const refSections = flatten(ref);
    const gotSections = flatten(menu);
    const gotByName = new Map();
    for (const s of gotSections) gotByName.set(norm(s.name), [...(gotByName.get(norm(s.name)) || []), s]);
    let matched = 0;
    let exact = 0;
    const perSection = [];
    for (const s of refSections) {
      const found = gotByName.get(norm(s.name))?.shift();
      if (found) {
        matched++;
        if (found.products.length === s.products.length) exact++;
      }
      perSection.push({ name: s.name, ref: s.products.length, got: found ? found.products.length : null });
    }
    const refProducts = refSections.flatMap((s) => s.products);
    const gotProducts = gotSections.flatMap((s) => s.products);
    const pool = new Map();
    for (const p of gotProducts) pool.set(norm(p.name), (pool.get(norm(p.name)) || 0) + 1);
    let nameHits = 0;
    for (const p of refProducts) {
      const n = pool.get(norm(p.name)) || 0;
      if (n > 0) {
        nameHits++;
        pool.set(norm(p.name), n - 1);
      }
    }
    const refDescHits = new Set(refProducts.filter((p) => PRICE_IN_TEXT.test(p.description || "")).map((p) => norm(p.name)));
    const priceInDescription = gotProducts.filter((p) => PRICE_IN_TEXT.test(p.description || "") && !refDescHits.has(norm(p.name))).map((p) => ({ name: p.name, description: p.description }));
    const refMulti = refProducts.filter((p) => p.prices.length > 1);
    const gotByProduct = new Map(gotProducts.map((p) => [norm(p.name), p]));
    const variantsOk = refMulti.filter((p) => {
      const g = gotByProduct.get(norm(p.name));
      return g && g.prices.length > 1 && g.prices.every((x) => x.label);
    }).length;
    const refPriceByName = new Map(refProducts.map((p) => [norm(p.name), p.prices.map((x) => x.price).join("/")]));
    const priceDiffs = gotProducts.filter((p) => refPriceByName.has(norm(p.name)) && refPriceByName.get(norm(p.name)) !== p.prices.map((x) => x.price).join("/")).map((p) => `${p.name}: ${p.prices.map((x) => x.price).join("/")} (ref ${refPriceByName.get(norm(p.name))})`);
    Object.assign(r, {
      sections: { ref: refSections.length, got: gotSections.length, matchedByName: matched, exactCount: exact, matchedRatio: +(matched / refSections.length).toFixed(3) },
      products: { ref: refProducts.length, got: gotProducts.length, deviation: +((gotProducts.length - refProducts.length) / refProducts.length).toFixed(3), nameMatchRate: +(nameHits / refProducts.length).toFixed(3) },
      priceInDescription,
      variants: { refWithMany: refMulti.length, ok: variantsOk },
      priceDiffsInformational: priceDiffs,
      perSection
    });
    if (priceInDescription.length) reasons.push(`${priceInDescription.length} prices inside descriptions`);
    if (r.sections.matchedRatio < 0.9) reasons.push(`sections ${matched}/${refSections.length} < 90%`);
    if (Math.abs(r.products.deviation) > 0.1) reasons.push(`products ${gotProducts.length} vs ${refProducts.length} outside +-10%`);
    if (refMulti.length && variantsOk < refMulti.length) reasons.push(`variants ${variantsOk}/${refMulti.length}`);
  }
  r.verdict = reasons.length ? "fail" : "ok";
  r.reasons = reasons;
  return r;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [outDir, refFile] = process.argv.slice(2);
  if (!outDir) {
    console.error("usage: node validate.mjs <out dir> [reference menu.json]");
    process.exit(2);
  }
  const result = validate(outDir, refFile);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "ok" ? 0 : 1);
}
