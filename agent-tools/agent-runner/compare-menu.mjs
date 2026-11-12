// Usage: node compare-menu.mjs <job out dir> [reference menu.json]  (default: fixtures/menu-reference.json)
// Prints, as JSON, what validate.mjs does not list: sections per menu, missing/extra products, price and text differences.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_REFERENCE } from "./validate.mjs";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Levenshtein distance between two strings.
 * @param {string} a First string.
 * @param {string} b Second string.
 * @returns {number} the number of single-character edits that turn a into b.
 */
export function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

const flat = (menu) => menu.menus.flatMap((m) => m.sections.flatMap((s) => s.products.map((p) => ({ ...p, menu: m.name, section: s.name }))));
const priceText = (p) => p.prices.map((x) => (x.label ? `${x.label} ${x.price}` : String(x.price))).join(" / ") || "(none)";
const label = (p) => `${p.menu} > ${p.section} > ${p.name}`;

/**
 * Pairs output products with reference products: exact name first, then normalized name, then the closest unpaired name (same menu, similarity of at least 0.6).
 * @param {object[]} ref Flattened reference products.
 * @param {object[]} got Flattened output products.
 * @returns {{pairs: object[], missing: object[], extra: object[]}} pairs carry how they were matched (exact, norm, fuzzy).
 */
export function pairProducts(ref, got) {
  const pairs = [];
  const freeRef = new Set(ref);
  const freeGot = new Set(got);
  const pairBy = (key, how) => {
    for (const r of [...freeRef]) {
      const g = [...freeGot].find((x) => key(x) === key(r));
      if (g) (pairs.push({ ref: r, got: g, how }), freeRef.delete(r), freeGot.delete(g));
    }
  };
  pairBy((p) => `${p.menu}|${p.section}|${p.name}`, "exact");
  pairBy((p) => p.name, "exact");
  pairBy((p) => norm(p.name), "norm");
  for (const r of [...freeRef]) {
    let best = null;
    for (const g of freeGot) {
      const a = norm(r.name);
      const b = norm(g.name);
      const sim = 1 - distance(a, b) / Math.max(a.length, b.length, 1);
      if (sim >= 0.6 && (!best || sim > best.sim)) best = { g, sim };
    }
    if (best) (pairs.push({ ref: r, got: best.g, how: "fuzzy" }), freeRef.delete(r), freeGot.delete(best.g));
  }
  return { pairs, missing: [...freeRef], extra: [...freeGot] };
}

/**
 * Compares one job output with the reference menu.
 * @param {string} outDir The job's out/ folder.
 * @param {string} refFile Reference menu.json.
 * @returns {object} sections per menu, missing, extra, priceDiffs, textDiffs.
 */
export function compare(outDir, refFile) {
  const ref = JSON.parse(fs.readFileSync(refFile, "utf8"));
  const got = JSON.parse(fs.readFileSync(path.join(outDir, "menu.json"), "utf8"));
  const { pairs, missing, extra } = pairProducts(flat(ref), flat(got));
  const gotSectionNames = new Map(got.menus.map((m) => [m.name, m.sections.map((s) => s.name)]));
  const sectionsPerMenu = ref.menus.map((m) => {
    const gotNames = new Set(got.menus.flatMap((g) => g.sections.map((s) => norm(s.name))));
    const found = m.sections.filter((s) => gotNames.has(norm(s.name)));
    return { menu: m.name, ref: m.sections.length, foundByName: found.length, notFound: m.sections.filter((s) => !gotNames.has(norm(s.name))).map((s) => s.name), gotMenuSections: gotSectionNames.get(m.name)?.length ?? null };
  });
  const gotMenus = got.menus.map((m) => ({ name: m.name, sections: m.sections.length, products: m.sections.reduce((n, s) => n + s.products.length, 0) }));
  const priceDiffs = pairs.filter((x) => priceText(x.ref) !== priceText(x.got)).map((x) => ({ product: label(x.ref), got: priceText(x.got), ref: priceText(x.ref) }));
  const textDiffs = [
    ...pairs.filter((x) => x.ref.name !== x.got.name).map((x) => ({ field: "name", where: `${x.ref.menu} > ${x.ref.section}`, got: x.got.name, ref: x.ref.name, how: x.how })),
    ...pairs.filter((x) => (x.ref.description ?? "") !== (x.got.description ?? "")).map((x) => ({ field: "description", where: label(x.ref), got: x.got.description ?? "", ref: x.ref.description ?? "", distance: distance(x.got.description ?? "", x.ref.description ?? "") }))
  ];
  return {
    gotMenus,
    sectionsPerMenu,
    paired: pairs.length,
    missing: missing.map(label),
    extra: extra.map(label),
    priceDiffs,
    textDiffs
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [outDir, refFile = DEFAULT_REFERENCE] = process.argv.slice(2);
  if (!outDir) {
    console.error("usage: node compare-menu.mjs <out dir> [reference menu.json]");
    process.exit(2);
  }
  console.log(JSON.stringify(compare(outDir, refFile), null, 2));
}
