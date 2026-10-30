// Test del template N1 (Percentage, con dep externa locale). GREEN = correcto; RED = lo que debe fallar.
import assert from "node:assert/strict";
import Percentage from "./Percentage.js";

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try {
    fn();
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    fail++;
    console.log("  ✗", name, "→", e.message);
  }
};

console.log("=== GREEN ===");
t("parse number (fracción)", () => assert.equal(new Percentage(0.75).value, 0.75));
t("idempotente", () => assert.equal(new Percentage(new Percentage(0.5)).value, 0.5));
t("format depende del locale (es-CL ≠ en-US)", () => {
  const p = new Percentage(0.75);
  assert.notEqual(p.format("es-CL"), p.format("en-US")); // varían (espacio/símbolo) → confirma dep de locale
});
t("format muestra el porcentaje", () => assert.match(new Percentage(0.755).format("en-US"), /75\.50\s*%/));
t("toXLS proyecta celda %", () => assert.deepEqual(new Percentage(0.75).toXLS(), {t: "n", v: 0.75, z: "0.00%"}));
t("toPrimitive → fracción (aritmética)", () => assert.equal(new Percentage(0.2) + new Percentage(0.3), 0.5));
t("nullish → isEmpty + toJSON null", () => {
  const p = new Percentage(null);
  assert.equal(p.isEmpty, true);
  assert.equal(p.toJSON(), null);
});

console.log("\n=== RED ===");
t("format SIN locale → PLR (dep externa no default)", () => assert.throws(() => new Percentage(0.5).format()));
t("valor inválido → throw", () => assert.throws(() => new Percentage("abc")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
