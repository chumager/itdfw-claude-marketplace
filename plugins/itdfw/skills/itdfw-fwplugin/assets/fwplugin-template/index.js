/*
 * FWP <name> — plantilla. Copiá esta carpeta a `plugins/<name>/` (externo/distribuible) o a
 * `back/itdfw/src/SITE/FWPlugins/<name>/` (del deploy), renombrá los esqueletos y rellená.
 * El index SOLO ENSAMBLA. El motor lee las keys que exportás → borrá las que no uses.
 *
 * 🔴 El scope va con `inFront`/`inBack` A NIVEL DE MÓDULO, y los imports del back DINÁMICOS dentro de
 * la rama. Nunca `function(db)`: el motor llama `plugin.call(this)` sin args → falla MUDO. Ver skill.
 */
/* global inFront, inBack */
let exp = {};

if (inFront) exp = {vue: {myComp: new URL("./vue", import.meta.url).pathname}};

if (inBack)
  exp = async function () {
    const {db, pool} = this; // por BINDEO (this = instancia Schema), jamás por parámetro
    return {
      name: "My Plugin",
      types: [(await import("./mongooseTypes/MyType.js")).default],
      plugins: [(await import("./mongoosePlugins/myPlugin.js")).default],
      schemas: [
        (await import("./mongooseSchema/MyModel.js")).default,
        (await import("./mongooseSchema/MyTypeTest.js")).default // test model: it escapes itself outside dev
      ],
      // API / db / libs → agregá las keys que uses (ver skill)
      vue: {myComp: new URL("./vue", import.meta.url).pathname}
    };
  };

export default exp;
