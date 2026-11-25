# Cascade Inheritance (localImport for extends)

When a core component extends ANOTHER core component that might be overridden by front/site (e.g., ItdPercentage extends ItdNumber), use `localImport` instead of direct import. This makes the component async but ensures cascade resolution — if front overrides ItdNumber, ItdPercentage picks up that override.

## JSX/JS — top-level await (preferred)

```javascript
/*global localImport*/
const Extends = await localImport("ItdNumber");
export default {
  name: "ItdPercentage",
  extends: Extends,
  // ...
};
```

Top-level `await` makes the module an async module automatically. The export is a Promise that the loader system resolves (`await (await importer()).default`). Clean, no wrapper needed.

## SFC (.vue) — Promise.resolve wrapper

Only when you need `<style>` (e.g., ItdNumber has CSS for formatting). SFC can't use top-level await in `<script>`.

```javascript
export default Promise.resolve().then(async () => {
  return {
    name: "ItdNumber",
    extends: await localImport("ItdString"),
    // ...
  };
});
```

## Convention

Use `Extends` (PascalCase) as variable name. `extends` is a JS reserved word (classes). `Extends` signals "this is the parent, but I couldn't name it `extends`".

## When to use

| Scenario | Use | Why |
|----------|-----|-----|
| Core extending GI | `/*global GenericInput*/` | GI is always global, processed by loaders |
| Core extending another core (default) | `await localImport("ItdNumber")` | Front might override Number — cascade resolves |
| Front extending core | `import CoreX from "core/components/ItdX.jsx"` | Direct OK — front loaded via localImport |

## Default: localImport para preservar transitividad

Regla por defecto: **siempre `localImport` cuando extiendes un componente que vive en core**, salvo el caso explícito de excepción descrito abajo.

La transitividad de capas (app → front → core):
- core define la base lógica + render genérico (tags HTML nativos).
- front (BV/NUI/PV) puede override tags/render para adaptar a su UI lib (ej: NUI overridea `<select>` por `<n-select>` en ItdSelect).
- app puede override aún más fino para casos puntuales del sitio.

Si haces `import directo` desde core, **te saltas las capas superiores** — pierdes el `<n-select>` de NUI y terminas con `<select>` HTML feo, o con tags que el front esperaba sustituir.

`localImport` resuelve por cascada y agarra el más cercano a app, manteniendo la cadena de overrides intacta.

## Excepción: import directo intencional

Solo importa directo del core cuando estés **100% seguro** de que necesitas la base LÓGICA pura y NO quieres que las capas superiores te toquen los renders/tags.

**Caso típico**: vas a renderizar TODO tú a mano (no quieres que el front te cambie tags) pero quieres reusar la lógica del core (validación, valueProp, vModel pipeline, etc.).

```javascript
// Caso lícito: necesito SOLO la lógica de ItdNumber (parsing, formatter)
// pero voy a renderizar mi propia UI custom sin n-input-number ni b-form-input.
import ItdNumberCore from "core/components/ItdNumber.jsx";
```

Si lo haces "porque sí" o por reflejo de "el path está más cerca", caes en condoro: tu componente pasa a depender solo de tags genéricos del core en un front que tenía override útil.

## Cómo detectar el condoro a tiempo

Pregunta antes del import:
1. ¿El componente que extiendo tiene override en el front (NUI/BV/PV)? Si sí → `localImport`.
2. ¿Quiero los renders/tags del front, o solo la lógica? Si solo lógica + render propio → directo.
3. Si dudas → `localImport`. Es el default seguro.

## Ejemplo: ItdModelInput

`ItdModelInput` extiende `ItdSelect`. Con `import ItdSelect from "./ItdSelect.jsx"` directo del core, el override de ItdSelect de NUI (que usa `<n-select>` con UX adecuada) queda fuera: la cadena se corta y ItdModelInput renderiza con `<select>` HTML feo en NUI.

Fix: `const ItdSelect = await localImport("ItdSelect");` — restablece la transitividad.

## Setup no se hereda → named export + re-export (transitividad)

`setup()` **NO se hereda** por `extends` (Vue 3: `setup` no está en las option merge strategies; doc oficial: "all options except setup() will be merged"). Para que el setup viaje por la cascada **igual que el componente** (`site → front → core`), cada nivel exporta su setup como **named export** y el siguiente lo **importa, compone y re-exporta**.

Patrón (mismo modelo transitivo que el componente):
- **core**: define `A` + `export function setup() {...}` (lógica base, ej. `useBackend()` → punteros del backend).
- **front**: `import A, {setup as coreSetup}`; compone y re-exporta:
  ```javascript
  export function setup(props, ctx) { return {...coreSetup(props, ctx), ...extra(props, ctx)}; }
  export default { extends: A, setup /* shorthand al named export */, ... };
  ```
- **site**: `import AFront, {setup as frontSetup}`; compone el suyo y re-exporta igual.

Así el setup se resuelve `site → front → core` en cascada, igual que render/tags. Si un nivel deja el setup **inline** (sin re-exportar), **corta la transitividad**: el nivel superior no puede componer sobre él.

**NO usar lib-cascade** (`localImport("useX","lib")` + `lib/useX.js`) para esto — approach descartado (archivo intermedio, más enredado). El named-export-setup es directo y mantiene la cascada.

Ejemplo: **ContentWrapper** migrado de lib-cascade (`useContentWrapper.js`) a named-export-setup. Core exporta `setup` (`useBackend` → checkHelp/getHelp); NUI `import {setup as coreSetup}` + compone (`useDialog` + `provide("NUIdialog")`) + re-exporta.

## Real-world components

ItdPercentage, ItdRange, ItdCurrency, ItdMixed, ItdSelectMulti, ItdModelInput.
