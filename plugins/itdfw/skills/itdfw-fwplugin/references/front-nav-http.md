# Ítems en las barras, el menú y cómo llamar una punta propia desde el front

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

Dos cosas del front de un plugin que no se adivinan (gap #42, 2026-09-20): **un ítem en las barras** se agrega
desde el `vue/init.js` del plugin con `this.store.commit("app/setNavItem", {key, component, sink, position:
"first" | "center" | "last", pos, when})`, donde `sink` es `"nav"`, `"side"`, `"drawer"`, un arreglo o una función
del ancho; y la fuente del menú se enchufa con `commit("app/setMenu", {ref})` (modelo completo: skill `itdfw-nui` §5;
ejemplo vivo: el plugin `typesafe-palette`). Un plugin que no deja elegir el sink de lo que agrega le quita
la libertad al site. Y **una punta propia se llama** con `this.$http.get/post/put(url, body, {params})`, nunca con
`fetch` ni `axios` importados.
