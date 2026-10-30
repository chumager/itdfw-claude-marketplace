/*
 * MyType — custom type. Con `class: MyVO`, el caster del FW (#loadTypesFromObject) arma el wrapper estándar
 * (RegExp/null/idempotente/new) y forwardea la firma completa al VO. NO escribas el cast a mano salvo que
 * el VO NO sea homologable. Detalle: skill itdfw-mongoose-types → references/type-definition.md.
 */
import MyVO from "../lib/MyVO.js";

export default {
  MyType: {
    class: MyVO, // o `extends: "String"` para especializar un type conocido; o `cast(v){…}` custom
    options: {
      component: "MyComp" // + toFilter/toPDF/lazy/forceAttrs… según lo que consuma el plugin toXXX
    }
  }
};
