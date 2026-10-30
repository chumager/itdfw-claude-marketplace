# Cascade Import System

## Vertical Search (basePaths)

```
@ (app/site) → default → plugins → itdfw (front) → core
```

Generated in `itdfw-vite-plugin/index.js` as virtual module `virtual:itdfw-custom-import.js`.

### Three Import Functions

| Function | Returns | Order | Use for |
|----------|---------|-------|---------|
| `customImport(comp, base)` | First found | @ → default → ... → core | Single component/module |
| `customImportArray(comp, base)` | All found | core → ... → @ (reversed) | Mixins, init.js, store plugins |
| `customImportMerge(comp, base)` | Merged object | core → ... → @ (reversed) | Config objects |

### localImport = customImport + processComponent

```
localImport("String", "components")
  → customImport("String", "components")     // cascade search
  → processComponent(obj, "String", "components")  // loaders + injections + compat
  → return processed module
```

## Horizontal Search (6 Name Variants)

For `localImport("string")` at each cascade level:

1. `string` (original)
2. `string` (camelCase)
3. `String` (PascalCase)
4. `itd-string` (ITD-prefixed kebab)
5. `itdString` (ITD camel)
6. `ItdString` (ITD pascal)

Normalization: `itd-`/`itd_` prefix stripped first, then variants generated. `localImport("itd-string")` and `localImport("string")` find the same file.

## skipDefault

When `process.env.VUE_APP_NODEFAULT` or `cwd === DEFAULT/vue/src`:
- Removes `"default"` from basePaths entirely
- App IS the default — no need to search "default" separately

## Directory Structure per Level

```
src/
  components/     — discovered by localImport("Name") or localImport("Name", "components")
  controllers/    — discovered by localImport("Name", "controllers")
  mixins/         — discovered by localImport("Name", "mixins")
  views/          — discovered by viewImport("Name")
  lib/            — DIRECT import only (not cascade). localImport("Name", "lib")
  injections/     — auto-loaded by processComponent
  store/modules/  — loaded by loadStoreModules (glob)
  store/plugins/  — loaded by loadStorePlugins (glob)
  css/            — cascadeStyle.css / mergedStyle.css (ver abajo: NO se comportan igual)
  init.js         — bootstrap customization
  router.js       — route definitions
```

## 🔴 Los CSS: dos mecanismos opuestos con nombres parecidos

`init.js:1003-1008` los carga con funciones DISTINTAS, y ahí está toda la diferencia:

```js
this.customImport("cascadeStyle.css", "css");        // first-return → gana UNO solo
this.customImportArray("mergedStyle.css", "css");    // acumulado   → se cargan TODOS
```

| Archivo | Mecanismo | Qué pasa si tu nivel lo declara |
|---|---|---|
| `cascadeStyle.css` | `customImport` (first-return) | 🔴 **reemplaza al de abajo**: el del site MATA el del core. Todo o nada |
| `mergedStyle.css` | `customImportArray` (acumulado) | se SUMA: core primero, tu nivel último (y por orden, gana el tuyo) |

⟹ **Para afinar estilos desde un site o un front, el archivo es `mergedStyle.css`.** `cascadeStyle.css` es
para reemplazar la base entera, y casi nunca es lo que se quiere.

Qué existe hoy: el core trae `cascadeStyle.css` y `mergedStyle.css`; NUI trae **solo** `mergedStyle.css` —
o sea la capa de render afina, no reemplaza. Lo dice el propio comentario del core: *"La capa de render
(NUI) afina estas mismas clases a su forma de pintar filas"*.

**Tercer mecanismo, que no es cascada**: un CSS propio de un componente se importa directo desde su SFC
(`ItdNumber.vue:143` → `<style scoped src="core/css/number.css">`). Por eso `core/src/css/number.css` existe
y no lo carga ninguna de las dos funciones de arriba. Si un CSS es de UN componente, va así — no al
`mergedStyle`.
