# Frameworks soportados y el mecanismo de Vite — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

```js
// índice del plugin (o key del FWPlugin) — self-declara sus paths con import.meta.url
export default {
  vue2:   { currency: new URL('./vue2',   import.meta.url).pathname },
  vue3:   { currency: new URL('./vue3',   import.meta.url).pathname },
  react:  { currency: new URL('./react',  import.meta.url).pathname },
  svelte: { currency: new URL('./svelte', import.meta.url).pathname },
  solid:  { currency: new URL('./solid',  import.meta.url).pathname },
  lit:    { currency: new URL('./lit',    import.meta.url).pathname }
};
```

**Frameworks soportados out-of-the-box**: `vue2`, `vue3`, `react`, `svelte`, `solid`, `lit`
(extensible — se pueden agregar/override pasando un mapa de detección al plugin de Vite). El **valor de
cada nombre lógico es un PATH a un DIRECTORIO** (ej. `./vue2`), no a archivos sueltos — el FW resuelve
los componentes dentro de esa carpeta vía la cascada de `customImport`. El front por framework asume que
existe una **front-library** montada para ese framework (cómo se arma un front nuevo → skill
`itdfw-front-creation`); este skill solo cubre cómo el plugin la declara/enchufa.

**Mecanismo** (`@chumager/itdfw-vite-plugin` + `.itdfw.js` del sitio):
1. Vite detecta el framework activo desde sus propios plugins (el framework va primero en `plugins[]`).
2. El plugin ITDFW extrae los aliases del framework detectado desde los plugins mergeados (`configArray('plugins')`).
3. Genera el módulo virtual `virtual:itdfw-custom-import` con búsqueda en **cascada**:
   `@/<comp>` (app) → `default/<comp>` (sitio) → `currency/<comp>` (plugins) → `itdfw/<comp>` (front, NUI) →
   `core/<comp>` (el plugin de vite del framework, `basePaths` de `customImport`). **La app y el default mandan
   siempre**; un plugin pisa al front y al core, nunca al site. Los merges (`init.js`, store) recorren al revés (core
   primero) para que la app gane igual; `public/` se copia de abajo hacia arriba por lo mismo.
4. El front consume agnóstico: `const C = await customImport('ItdCurrency')` — el mismo código corre en
   cualquier framework; el plugin resuelve al binario correcto.

⟹ un FWPlugin enchufa UI en el front sin que la app sepa nada, y framework-agnóstico. Es la pieza que
permite que el plugin sea de verdad back2front.
