// Test del template N1 (Complex). GREEN = el patrón correcto pasa. RED = los anti-patrones/errores fallan.
// Corre: node skills/itdfw-mongoose-types/templates/Complex.test.js
import assert from "node:assert/strict";
import Complex from "./Complex.js";

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

console.log("=== GREEN: el VO bien hecho ===");
t("parse number → {re, im:0}", () => assert.deepEqual({...new Complex(3)}, {re: 3, im: 0}));
t("parse objeto {re, im}", () => assert.deepEqual({...new Complex({re: 3, im: 4})}, {re: 3, im: 4}));
t("parse string '3+4i'", () => assert.deepEqual({...new Complex("3+4i")}, {re: 3, im: 4}));
t("idempotente", () => assert.deepEqual({...new Complex(new Complex("1-2i"))}, {re: 1, im: -2}));
t("getter derivado modulus (3,4)→5", () => assert.equal(new Complex("3+4i").modulus, 5));
t("aritmética add (inmutable)", () => assert.deepEqual({...new Complex("1+2i").add("3+4i")}, {re: 4, im: 6}));
t("aritmética multiply", () => assert.deepEqual({...new Complex("1+1i").multiply("1+1i")}, {re: 0, im: 2}));
t("format propio", () => assert.equal(new Complex({re: 3, im: -4}).format(), "3-4i"));
t("toPrimitive string → format", () => assert.equal(`${new Complex("3+4i")}`, "3+4i"));
t("toPrimitive number → modulus", () => assert.equal(+new Complex("3+4i"), 5));
t("nullish → isEmpty + toJSON null", () => {
  const c = new Complex(null);
  assert.equal(c.isEmpty, true);
  assert.equal(c.toJSON(), null);
});

console.log("\n=== RED: lo que DEBE fallar (validación estructural propia) ===");
t("string mal formado → throw", () => assert.throws(() => new Complex("hola")));
t("objeto con re no-number → throw", () => assert.throws(() => new Complex({re: "x", im: 1})));
t("firma no reconocida (boolean) → throw", () => assert.throws(() => new Complex(true)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
