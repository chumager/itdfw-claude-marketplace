/*global localImport*/
/*
 * ItdMyComp — componente front. Extiende un GI del core y overridea data/methods (skill itdfw-front-develop).
 * `vue/` sirve para vue2 Y vue3. Si consume un VO isomorphic, importalo de ../../lib/ y reconstruilo en un
 * computed (Vue observa el computed, no las mutaciones internas de un VO inmutable).
 */
const Extends = await localImport("GenericInput"); // o "ItdNumber", "ItdString", "ItdSelect"…
export default {
  name: "ItdMyComp",
  extends: Extends,
  data() {
    return {};
  },
  computed: {},
  methods: {}
};
