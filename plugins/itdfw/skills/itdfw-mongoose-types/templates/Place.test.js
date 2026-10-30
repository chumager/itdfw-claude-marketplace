// Test del template N3 (VO con puntas). GREEN: VO + parsers + API en el type. RED: lo que debe fallar.
import assert from "node:assert/strict";
import {Place, placeType} from "./Place.js";

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
t("parse objeto {coordinates,label}", () => assert.equal(new Place({coordinates: [-70.6, -33.4], label: "Stgo"}).lng, -70.6));
t("parse string serializado", () => assert.equal(new Place(JSON.stringify({coordinates: [1, 2]})).coordinates[1], 2));
t("idempotente", () => assert.equal(new Place(new Place({coordinates: [1, 2]})).lng, 1));
t("nullish → isEmpty + toJSON null", () => {
  const p = new Place(null);
  assert.equal(p.isEmpty, true);
  assert.equal(p.toJSON(), null);
});
t("toBSON → Point", () => assert.equal(new Place({coordinates: [1, 2]}).toBSON().type, "Point"));
t("parser de provider (raw → options)", () => {
  const opts = Place.toOptions({items: [{name: "Plaza", coords: [1, 2]}]}, "foo");
  assert.equal(opts[0].text, "Plaza");
  assert.equal(JSON.parse(opts[0].value).coordinates[0], 1);
});
t("ATOMICIDAD: el API vive EN el type (options.API)", () => {
  assert.ok(placeType.Place.options.API.placeAutocomplete, "el type debe declarar sus puntas en options.API");
  assert.equal(typeof placeType.Place.options.API.placeAutocomplete.GET, "function");
});

console.log("\n=== RED ===");
t("coordinates inválidas → throw", () => assert.throws(() => new Place({coordinates: [1]})));
t("parser inexistente → throw", () => assert.throws(() => Place.toOptions({}, "noExiste")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
