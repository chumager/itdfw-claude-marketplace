/**
 * PostToolUse hook for Edit|Write|MultiEdit: the comment police. On a JS/JSX file it blocks (exit 2) an edit that
 * added comment noise (too many comment lines, long blocks, commented-out code, dated comments) and warns when the
 * whole file is saturated with comments. JSDoc is exempt.
 * Needs `espree`: ITDFW_HOOKS_DEPS = directory that holds node_modules/espree (default: $HOME/.claude/hook-deps).
 */
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const depsDir = process.env.ITDFW_HOOKS_DEPS || `${process.env.HOME}/.claude/hook-deps`;
const espree = require(`${depsDir}/node_modules/espree`);

const CODE_EXT = /\.(js|jsx|mjs|cjs)$/;
const DELTA_RATIO = 0.15;
const DELTA_MIN = 3;
const BLOCK_MAX = 2;
const FILE_RATIO = 0.1;
const FILE_MIN = 30;

const ok = () => process.exit(0);
const fail = msg => {
  process.stderr.write(msg);
  process.exit(2);
};

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  ok();
}

const file = payload.tool_input?.file_path;
if (!file || !CODE_EXT.test(file)) ok();

let source;
try {
  source = readFileSync(file, "utf8");
} catch {
  ok();
}

// lines this edit added (numbering of the NEW file)
const added = new Set();
const patch = payload.tool_response?.structuredPatch;
if (Array.isArray(patch) && patch.length) {
  for (const hunk of patch) {
    let n = hunk.newStart;
    for (const line of hunk.lines) {
      if (line[0] === "-") continue;
      if (line[0] === "+") added.add(n);
      n++;
    }
  }
} else {
  // new file: everything is delta
  source.split("\n").forEach((_, i) => added.add(i + 1));
}
if (!added.size) ok();

let comments;
try {
  comments = espree.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    comment: true,
    loc: true,
    ecmaFeatures: {jsx: true}
  }).comments;
} catch {
  ok(); // does not parse (vue, odd syntax) -> do not bother
}

const lines = source.split("\n");
const isJSDoc = c => c.type === "Block" && c.value.startsWith("*");
// commentLines = all of them (so they are not counted as code); noiseLines = the ones that weigh (JSDoc exempt).
const commentLines = new Set();
const noiseLines = new Set();
for (const c of comments)
  for (let n = c.loc.start.line; n <= c.loc.end.line; n++) {
    commentLines.add(n);
    if (!isJSDoc(c)) noiseLines.add(n);
  }

// --- (1) the DELTA: did this edit add noise?
const deltaComment = [...added].filter(n => noiseLines.has(n));
const deltaCode = [...added].filter(n => !commentLines.has(n) && lines[n - 1]?.trim());
const problems = [];

if (deltaComment.length >= DELTA_MIN && deltaComment.length > deltaCode.length * DELTA_RATIO)
  problems.push(`${deltaComment.length} comment lines for ${deltaCode.length} lines of code.`);

// longest block of added comment
let run = 0;
let maxRun = 0;
for (let n = Math.min(...added); n <= Math.max(...added); n++) {
  run = added.has(n) && noiseLines.has(n) ? run + 1 : 0;
  if (run > maxRun) maxRun = run;
}
if (maxRun > BLOCK_MAX) problems.push(`block of ${maxRun} consecutive comment lines (maximum ${BLOCK_MAX}).`);

// commented-out code: the comment text parses as JS
const stripped = c =>
  c.value
    .split("\n")
    .map(l => l.replace(/^\s*\*/, ""))
    .join("\n");
const dead = comments
  .filter(c => added.has(c.loc.start.line))
  .filter(c => {
    const txt = stripped(c);
    if (!/[;={}()]|=>/.test(txt)) return false;
    try {
      const ast = espree.parse(txt, {ecmaVersion: "latest", sourceType: "module", ecmaFeatures: {jsx: true}});
      return ast.body.length > 0;
    } catch {
      return false;
    }
  });
if (dead.length)
  problems.push(`${dead.length} block(s) of commented-out CODE (lines ${dead.map(c => c.loc.start.line).join(", ")}) - git has it, delete it.`);

// tombstones
const tomb = comments.filter(c => added.has(c.loc.start.line) && /\b20\d\d-\d\d-\d\d\b/.test(c.value));
if (tomb.length) problems.push(`${tomb.length} dated comment(s) (line ${tomb.map(c => c.loc.start.line).join(", ")}) - git blame already gives that.`);

// --- (2) the FILE: is it saturated?
const nonEmpty = lines.filter(l => l.trim()).length;
const fileComment = [...noiseLines].filter(n => lines[n - 1]?.trim()).length;
const ratio = nonEmpty ? fileComment / nonEmpty : 0;
const saturated = nonEmpty >= FILE_MIN && ratio >= FILE_RATIO;

if (!problems.length && !saturated) ok();

let msg = "";
if (problems.length) {
  msg += `🔴 COMMENTS - ${file}\n`;
  for (const p of problems) msg += `  · ${p}\n`;
  msg += `A comment is a SECOND source of truth that nobody updates: the code changes, the comment lies. Lateral debt.\nOnly comment the BLACK MAGIC (what the code cannot say). Readable code is NOT commented.\nThe history of the change goes to git; the explanation goes to the CHAT.\nPrune what you just wrote BEFORE moving on.\n`;
}
if (saturated) {
  msg += `⚠️ FILE SATURATED - ${file}: ${fileComment}/${nonEmpty} lines are comments (${Math.round(ratio * 100)}%).\nTell the user this file needs pruning.\n`;
}
fail(msg);
