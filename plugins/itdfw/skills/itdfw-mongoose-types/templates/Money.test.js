// Test del template N2 (VO con entorno + pub/sub). Mock del doc con EventEmitter (sin mongoose).
// GREEN: el patrón opera (hereda currency del root, reacciona al cambio, no acumula listeners). RED: PLR.
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {Money, castMoney} from "./Money.js";

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

// mock de "doc": EE + _currency + ownerDocument() que devuelve sí mismo (el root) + setter que emite.
const makeDoc = currency => {
  const doc = new EventEmitter();
  doc._currency = currency;
  doc.ownerDocument = () => doc;
  doc.setCurrency = c => {
    doc._currency = c;
    doc.emit("newCurrency", c);
  };
  return doc;
};

console.log("=== GREEN ===");
t("hereda currency del root al castear", () => {
  const doc = makeDoc("CLP");
  const m = castMoney(1000, doc);
  assert.equal(m.currency, "CLP");
});
t("reacciona al cambio de _currency (pub/sub)", () => {
  const doc = makeDoc("CLP");
  const m = castMoney(1000, doc);
  doc.setCurrency("USD");
  assert.equal(m.currency, "USD"); // el VO reaccionó vía su listener
});
t("re-castear NO acumula listeners (prev limpia)", () => {
  const doc = makeDoc("CLP");
  let m = castMoney(1000, doc);
  m = castMoney(2000, doc, false, m); // prev = el VO viejo
  m = castMoney(3000, doc, false, m);
  assert.equal(doc.listeners("newCurrency").length, 1); // 1 vivo, no 3
});
t("FCC: null → null", () => assert.equal(castMoney(null, makeDoc("CLP")), null));
t("precisión intrínseca (CLP 0 / USD 2), sin locale", () => {
  assert.equal(new Money(1, "CLP").fractionDigits, 0);
  assert.equal(new Money(1, "USD").fractionDigits, 2);
});

console.log("\n=== RED ===");
t("fractionDigits sin currency → PLR", () => assert.throws(() => new Money(1, null).fractionDigits));
t("format sin locale → PLR", () => assert.throws(() => new Money(1, "USD").format()));
t("amount inválido → throw", () => assert.throws(() => new Money("abc", "CLP")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
