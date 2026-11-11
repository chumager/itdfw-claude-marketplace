#!/usr/bin/env node
/**
 * Component INVENTORY — the double tree (inheritance + callers), pure scripting, CONFIG-DRIVEN.
 *
 * Config: `inventory.config.json` in the current directory, or the file named by `INVENTORY_CONFIG`. The directory
 * that holds the config is the ROOT: every relative path in it resolves against that root, and `inventory.json` is
 * written next to it. There is no built-in default: without a config the tool stops with an error.
 *
 * The config declares front directories (simple globs with ONE `*`), optional caller directories, external project
 * roots, and the search rules (front idioms: extends/mixins/imports/render; back keys: component/type/...; name
 * variants: with/without a prefix x pascal/camel/kebab).
 *
 * Tree 1 (extends): components under the `frontDirs`, identity = CASCADE SLOT (basename of the file: the real
 * identity of the framework, `localImport` resolves by name between layers).
 * Tree 2 (callers): `callerDirs` + projects declaring the component in the configured `keys` (including the implicit
 * rule type => component) + render references in the front directories.
 *
 * orphans = FLAGS to evaluate a CONTRACT, never a delete list (a transitive core with zero hits is a capability
 * waiting for a consumer).
 *
 * CLI: node scan.mjs [affected|branch|callers|hascaller <X>] [orphans] — no args: summary + inventory.json
 */
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from "node:fs";
import {join, basename, dirname, resolve} from "node:path";
import {pathToFileURL} from "node:url";

const COMPONENT_EXT = /\.(jsx|js|vue)$/;
const CALLER_EXT = /\.(js|jsx|mjs)$/;
const CONFIG_NAME = "inventory.config.json";

/**
 * Finds and parses the config. Never falls back to a default.
 * @param {{cwd?: string, env?: Object}} [from] Where to look: the working directory and the environment.
 * @returns {{cfg: Object, root: string, file: string}} The parsed config, the directory that holds it and its path.
 * @throws {Error} `inventory.config.json not found in <cwd>` (or `<path> not found` when `INVENTORY_CONFIG` names it).
 */
export function loadConfig({cwd = process.cwd(), env = process.env} = {}) {
  const file = env.INVENTORY_CONFIG ? resolve(cwd, env.INVENTORY_CONFIG) : join(cwd, CONFIG_NAME);
  if (!existsSync(file)) throw new Error(env.INVENTORY_CONFIG ? `${file} not found` : `${CONFIG_NAME} not found in ${cwd}`);
  return {cfg: JSON.parse(readFileSync(file, "utf8")), root: dirname(file), file};
}

/**
 * Pulls the `@spec <path>` tags out of a component source.
 * @param {string} src Source text of a component file.
 * @returns {string[]} The declared paths, as written and without duplicates. Reads nothing from disk.
 */
export const specsOf = src => [...new Set([...src.matchAll(/@spec\s+(\S+)/g)].map(m => m[1]))];

/**
 * Builds the scan context: the config plus everything derived from it (directories to scan, matchers).
 * @param {{cfg: Object, root: string}} loaded The result of {@link loadConfig}.
 * @returns {Object} The context the scan functions take.
 */
function createContext({cfg, root}) {
  const skip = new RegExp(cfg.skip);
  const ctx = {cfg, root, skip};

  // helpers first: the directory lists below use them
  const listDirs = p => {
    if (!existsSync(p)) return [];
    return readdirSync(p)
      .filter(n => !n.startsWith(".")) // dot-dirs out (.pnpm-store, .git, etc.)
      .map(n => join(p, n))
      .filter(f => {
        try {
          return statSync(f).isDirectory() && !skip.test(f);
        } catch {
          return false;
        }
      });
  };
  ctx.listDirs = listDirs;
  // Expands a pattern with ONE directory `*`: "fronts/*/src" | "plugins/*/vue*" (the 2nd * is a prefix).
  const expandGlob = pattern => {
    const abs = pattern.startsWith("/") ? pattern : join(root, pattern);
    if (!abs.includes("*")) return existsSync(abs) ? [abs] : [];
    const [head, ...rest] = abs.split("*");
    const tail = rest.join("*"); // what follows the FIRST *
    return listDirs(dirname(head + "x")).flatMap(d => {
      if (!tail) return [d];
      if (tail.startsWith("/")) {
        // "fronts/*/src": inside each dir, the sub-path (which can carry its own prefix *)
        const sub = tail.slice(1);
        if (sub.includes("*")) {
          const prefix = sub.split("*")[0];
          return listDirs(d).filter(s => basename(s).startsWith(prefix) || new RegExp(sub.replace("*", ".*")).test(basename(s)));
        }
        const p = join(d, sub);
        return existsSync(p) ? [p] : [];
      }
      // "plugins/*vue*"-style: filter the children by regex
      return basename(d).match(new RegExp(`^${basename(head + "*" + tail).replace(/\*/g, ".*")}$`)) ? [d] : [];
    });
  };

  // layer label of a front directory: the segment after /plugins/ or /fronts/, "core" inside the root, "external:<dir>" outside
  const layerOf = p =>
    p.includes("/plugins/")
      ? `plugin:${p.split("/plugins/")[1].split("/")[0]}`
      : p.includes("/fronts/")
        ? `front:${p.split("/fronts/")[1].split("/")[0]}`
        : !p.startsWith(root)
          ? `external:${basename(p)}`
          : "core";

  // external projects contribute in TWO ways: their fronts give components, their schemas give callers
  const projectDirsFor = subdirs =>
    (cfg.projectDirs ?? [])
      .map(p => resolve(root, p))
      .filter(existsSync)
      .flatMap(proj =>
      listDirs(proj).flatMap(app =>
        subdirs
          .map(sub => join(app, sub))
          .filter(existsSync)
          .map(p => [`${basename(proj)}:${basename(app)}`, p])
      )
    );

  ctx.componentDirs = [
    ...cfg.frontDirs.flatMap(expandGlob).map(d => [layerOf(d), d]),
    ...projectDirsFor(cfg.projectFrontSubdirs ?? [])
  ];
  // `callerDirs`: [{layer, path}]; a `*` in `path` expands to directories and, inside `layer`, to the matched name
  ctx.callerDirs = [
    ...(cfg.callerDirs ?? []).flatMap(({layer, path}) =>
      path.includes("*") ? expandGlob(path).map(d => [layer.replace("*", basename(d)), d]) : expandGlob(path).map(d => [layer, d])
    ),
    ...projectDirsFor(cfg.projectScanSubdirs ?? [])
  ];

  ctx.rel = file => file.replace(`${root}/`, "");
  ctx.RE = {
    extends: new RegExp(cfg.rules.front.extends),
    mixins: new RegExp(cfg.rules.front.mixins, "g"),
    imports: cfg.rules.front.imports.map(r => new RegExp(r, "g")),
    name: /name:\s*["']([^"']+)["']/
  };
  return ctx;
}

function* walk(ctx, dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    if (ctx.skip.test(f)) continue;
    let st;
    try {
      st = statSync(f);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(ctx, f);
    else yield f;
  }
}

// ── name variants (config rules.variants): base with/without prefix x pascal/camel/kebab ──
const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const camel = s => s.charAt(0).toLowerCase() + s.slice(1);
const pascal = s => s.charAt(0).toUpperCase() + s.slice(1);
const FORMS = {pascal, camel, kebab};
function variantsOf(ctx, slot) {
  const {stripPrefix, forms} = ctx.cfg.rules.variants;
  const bases = [...new Set([slot, stripPrefix && slot.startsWith(stripPrefix) ? slot.slice(stripPrefix.length) : slot])];
  return [...new Set(bases.flatMap(b => forms.map(f => FORMS[f](b))))];
}

// ── phase 1: components + extends (front rules from the config) ──
function scanComponents(ctx) {
  const {RE} = ctx;
  const nodes = {};
  for (const [layer, dir] of ctx.componentDirs) {
    for (const file of walk(ctx, dir)) {
      if (!COMPONENT_EXT.test(file)) continue;
      const src = readFileSync(file, "utf8");
      const imports = {};
      for (const re of RE.imports)
        for (const m of src.matchAll(re)) imports[m[1]] = basename(m[2]).replace(COMPONENT_EXT, "");
      const ext = src.match(RE.extends);
      const mixins = [...src.matchAll(RE.mixins)].flatMap(m =>
        m[1]
          .split(",")
          .map(s => s.trim())
          .filter(s => /^[A-Za-z_$][\w$]*$/.test(s))
          .map(s => imports[s] ?? s)
      );
      const declared = src.match(RE.name);
      if (!declared && !ext) continue;
      const slot = basename(file).replace(COMPONENT_EXT, "");
      (nodes[slot] ??= {instances: []}).instances.push({
        file: ctx.rel(file),
        layer,
        name: declared?.[1] ?? null,
        extends: ext ? (imports[ext[1]] ?? ext[1]) : null,
        mixins,
        specs: specsOf(src)
      });
    }
  }
  return nodes;
}

// ── phase 2: callers (configured back keys, incl. type => component) + render references ──
function scanCallers(ctx, nodes) {
  const callers = {};
  const slots = Object.keys(nodes);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const backKeys = ctx.cfg.rules.back.keys.join("|");
  const renderFns = ctx.cfg.rules.front.render.join("|");
  const re = {};
  for (const slot of slots) {
    const alts = variantsOf(ctx, slot).map(esc).join("|");
    re[slot] = {
      decl: new RegExp(`(?:${backKeys}):\\s*["'](?:${alts})["']`),
      render: new RegExp(`(?:${renderFns})\\(\\s*["'](?:${alts})["']`)
    };
  }
  const scanSet = (dirs, key, pick) => {
    for (const [layer, dir] of dirs) {
      for (const file of walk(ctx, dir)) {
        if (!CALLER_EXT.test(file)) continue;
        let src;
        try {
          src = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        for (const slot of slots) {
          if (pick(slot).test(src)) ((callers[slot] ??= {})[key] ??= []).push(`${layer} ${ctx.rel(file)}`);
        }
      }
    }
  };
  scanSet(ctx.callerDirs, "declared", slot => re[slot].decl);
  scanSet(ctx.componentDirs, "render", slot => re[slot].render);
  return callers;
}

/**
 * Scans the disk and builds the inventory.
 * @param {Object} ctx The scan context (from `createContext`).
 * @returns {{generatedAt: string, config: Object, nodes: Object, children: Object, callers: Object}} The inventory.
 */
function build(ctx) {
  const nodes = scanComponents(ctx);
  const callers = scanCallers(ctx, nodes);
  const children = {};
  for (const [slot, node] of Object.entries(nodes))
    for (const inst of node.instances) {
      if (inst.extends && inst.extends !== slot) (children[inst.extends] ??= []).push(slot);
      for (const mx of inst.mixins ?? []) if (mx !== slot) (children[mx] ??= []).push(`${slot} (mixin)`);
    }
  for (const k of Object.keys(children)) children[k] = [...new Set(children[k])];
  return {generatedAt: new Date().toISOString(), config: ctx.cfg, nodes, children, callers};
}
function descendants(inv, slot, seen = new Set()) {
  const out = [];
  for (const child of inv.children[slot] ?? []) {
    const c = child.replace(" (mixin)", "");
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(child, ...descendants(inv, c, seen).map(s => `  ${s}`));
  }
  return out;
}
function ancestors(inv, slot) {
  const out = [];
  let current = inv.nodes[slot];
  while (current) {
    const parent = current.instances.find(i => i.extends && i.extends !== out.at(-1))?.extends;
    if (!parent || out.includes(parent) || parent === slot) break;
    out.push(parent);
    current = inv.nodes[parent];
  }
  return out;
}

function specsBySlot(inv, slots) {
  const out = {};
  for (const s of slots.map(s => s.trim().replace(" (mixin)", "")))
    out[s] ??= Object.fromEntries((inv.nodes[s]?.instances ?? []).map(i => [i.file, i.specs]));
  return out;
}

// ── CLI ──
if (import.meta.url === pathToFileURL(process.argv[1]).href) cli();
function cli() {
  const [, , cmd, arg] = process.argv;
  if (["--help", "-h", "help"].includes(cmd)) {
    console.log(
      `usage: node scan.mjs <affected|branch|callers|hascaller|orphans> <slot>\n       node scan.mjs        (summary)\nReads ${CONFIG_NAME} from the current directory (or the file in INVENTORY_CONFIG).\nEvery query rescans the components and rewrites inventory.json next to the config; this help does not.`
    );
    return;
  }
  let ctx;
  try {
    ctx = createContext(loadConfig());
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    return;
  }
  const OUT = join(ctx.root, "inventory.json");
  const inv = build(ctx);
  writeFileSync(OUT, JSON.stringify(inv, null, 2));
  const print = o => console.log(typeof o === "string" ? o : JSON.stringify(o, null, 2));

  switch (cmd) {
    case "affected": {
      const desc = descendants(inv, arg);
      print({
        touching: arg,
        variants: variantsOf(ctx, arg),
        instances: inv.nodes[arg]?.instances.map(i => `${i.layer} ${i.file}`) ?? "SLOT DOES NOT EXIST",
        descendants: desc,
        callers: inv.callers[arg] ?? {},
        specsBySlot: specsBySlot(inv, [arg, ...desc])
      });
      break;
    }
    case "branch": {
      const anc = ancestors(inv, arg);
      const desc = descendants(inv, arg);
      print({slot: arg, ancestors: anc, node: inv.nodes[arg], descendants: desc, specsBySlot: specsBySlot(inv, [...anc, arg, ...desc])});
      break;
    }
    case "callers":
      print({slot: arg, variants: variantsOf(ctx, arg), ...(inv.callers[arg] ?? {declared: [], render: []})});
      break;
    case "hascaller": {
      const c = inv.callers[arg];
      print({slot: arg, hasCaller: !!(c?.declared?.length || c?.render?.length), where: c ?? {}});
      break;
    }
    case "orphans": {
      const orphans = Object.keys(inv.nodes).filter(
        slot => !(inv.children[slot]?.length || inv.callers[slot]?.declared?.length || inv.callers[slot]?.render?.length)
      );
      print({warning: "contract FLAGS, NOT delete candidates (transitive core)", orphans});
      break;
    }
    default:
      print({
        inventory: OUT,
        components: Object.keys(inv.nodes).length,
        instances: Object.values(inv.nodes).reduce((s, n) => s + n.instances.length, 0),
        withCallers: Object.keys(inv.callers).length,
        roots: Object.keys(inv.children).filter(k => !inv.nodes[k]),
        scannedDirs: ctx.componentDirs.map(([l, d]) => `${l} ${ctx.rel(d)}`),
        callerDirs: ctx.callerDirs.map(([l, d]) => `${l} ${ctx.rel(d)}`)
      });
  }
}
