/*
 * myPlugin — mongoose-plugin. 3 modos según la prop que traiga (skill itdfw-plugins):
 *   GLOBAL (sin filter/schema) · FILTERED `filter:"X"` (oferta dormida: el modelo declara la option) ·
 *   NAMED `schema:"Model"` (push dirigido, el modelo no se entera). Idempotente: checkAndLoadMethod/Virtual/Static.
 */
export default db => ({
  name: "myPlugin",
  // filter: "myFeature",   // FILTERED: se aplica solo si el schema declaró la option
  // schema: "SomeModel",   // NAMED: solo a ese/esos modelos
  plugin(schema) {
    // schema.checkAndLoadMethod({ myMethod() { /* ... */ } });
    // schema.checkAndLoadVirtual({ myVirtual() { return /* ... */; } });
  }
});
