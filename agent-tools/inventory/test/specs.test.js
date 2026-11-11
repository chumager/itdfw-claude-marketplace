import {test} from "node:test";
import assert from "node:assert/strict";
import {specsOf} from "../scan.mjs";

const component = tag => `/**\n * A component.\n * ${tag}\n */\nexport default {name: "ItdX"};\n`;

test("declared @spec tags are listed as written", () => {
  const src = component("@spec fronts/x/test/a.spec.js\n * @spec fronts/x/test/b.spec.js");
  assert.deepEqual(specsOf(src), ["fronts/x/test/a.spec.js", "fronts/x/test/b.spec.js"]);
});

test("a component without @spec lists none", () => {
  assert.deepEqual(specsOf(component("@see nothing")), []);
});
