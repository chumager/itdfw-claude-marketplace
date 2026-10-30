// TDD del VO — green + red. Puro node, sin levantar el FW (skill itdfw-completeness → test-discipline.md).
// El e2e completo (modelo multinested onDev + Playwright, back+front) vive también acá, en el plugin.
import assert from "node:assert/strict";
import MyVO from "../lib/MyVO.js";

let pass = 0;
let fail = 0;
const t = (n, fn) => {
  try {
    fn();
    pass++;
    console.log("  ✓", n);
  } catch (e) {
    fail++;
    console.log("  ✗", n, "→", e.message);
  }
};

console.log("=== GREEN ===");
t("value se expone", () => assert.equal(new MyVO(10).value, 10));
t("null → isEmpty + toJSON/toBSON null", () => {
  const v = new MyVO(null);
  assert.equal(v.isEmpty, true);
  assert.equal(v.toJSON(), null);
  assert.equal(v.toBSON(), null);
});

console.log("=== RED (lo que DEBE fallar, falla) ===");
// t("estado imposible → throw", () => assert.throws(() => new MyVO(/* inválido */)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
