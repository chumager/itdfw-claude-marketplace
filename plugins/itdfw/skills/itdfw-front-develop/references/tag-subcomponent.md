# Componente-tag: subcomponente Vue como `this.tag` (input ultra-complejo)

La "segunda derivada" del Decision Tree: cuando el control NO es un `<input>` estándar (Level 1-4) ni un
valor-objeto/sub-form (Level 5 = extend GF), sino un **widget custom complejo** — file uploader, editor
WYSIWYG, selector visual (mapa, color picker propio), date-range con calendario. Se construye un
**subcomponente Vue propio** y se enchufa como el control del GI, **sin reescribir el render del GI**.

## La técnica

Define un subcomponente con `$vModel: true` y asígnalo a `this.tag` en `created()`:

```js
created() {
  const self = this; // closure a la instancia GI (acceso a buttonTag, props, lógica)
  const subComponent = {
    name: "MiWidgetTrigger",
    $vModel: true,        // ← el loader inyecta vModelValue + vModelEmit: el sub ES un input del flujo
    inheritAttrs: false,
    props: {disabled: Boolean, placeholder: String /* los que el GI le pasa */},
    methods: {
      onPick(rawValue) {
        this.vModelEmit(rawValue); // ← emite al flujo GI (validateSelfValue, validación, lazy, ...)
      }
    },
    render() {
      // UI compleja encapsulada acá; this.vModelValue = el value actual
      return <MiWidgetUI value={this.vModelValue} onPick={this.onPick} disabled={this.disabled} />;
    }
  };
  // applyLoaders procesa el $vModel ANTES de que el GI rinda el tag (top-level await del loader)
  this.tag = async () => Promise.resolve(subComponent).applyLoaders();
}
```

## Por qué funciona

- El GI rinde `this.tag` como su control principal, igual que rendería un `<input>`.
- Vía `$vModel`, el subcomponente se comporta como un input estándar del flujo: recibe el value
  (`vModelValue`) y lo emite (`vModelEmit`). ⟹ **todo el aparato del GI sigue operando** (value,
  `validateSelfValue`, validación por tipo, lazy, state, buttons, preview) **sin tocar el render del GI**.
- La complejidad de UI queda **encapsulada** en el subcomponente; el GI no la conoce.
- A diferencia del Level 5 (extend GF, para valores objeto/sub-forms), acá el value puede ser cualquier cosa
  (un `File`, un blob, un objeto custom) y la UI es libre.

## Especialización por framework (override del trigger)

El subcomponente-tag se especializa por front igual que el resto del patrón core/front: el **core** define
el trigger por defecto; un **front** lo reemplaza si su librería de UI lo exige. Para que sea override-able,
extraé el subcomponente a un método (ej. `buildTrigger()`) y que el created llame `this.buildTrigger()`; el
front override ese método.

**Caso real**: `ItdFile` core usa `<input type="file">` nativo; NUI lo reemplaza por el `n-upload` de Naive
(cuyo `onChange` no es enchufable en un input nativo bajo el binding GI-NUI). Mismo `this.tag`, distinto
trigger por framework.

## Piezas clave

| Pieza | Rol |
|---|---|
| `$vModel: true` (en el sub) | el loader inyecta `vModelValue`/`vModelEmit` → el sub es un input del flujo |
| `this.tag = async () => Promise.resolve(sub).applyLoaders()` | applyLoaders procesa el `$vModel` antes del render del GI |
| `inheritAttrs: false` + `props` | recibe lo que el GI le pasa (disabled, placeholder, accept…) |
| `const self = this` | closure a la instancia GI para su config (buttonTag, buttonProps, métodos) |
| `vModelEmit(value)` | emite el value capturado al flujo GI |

## Cuándo NO usarlo

- Si un override de `formatter`/`render`/`initVal`/`emitter` basta (Level 1-4) → no inventes un subcomponente.
- Si el value es un objeto/sub-form → Level 5 (extend GF, [gf-direct-extension.md](gf-direct-extension.md)).
- Solo para controles que NO son un input estándar y necesitan UI propia que el GI no puede rendir configurando.

## Referencia de código

`ItdFile` (core front) — file uploader con preview/download: el `this.tag`
es el trigger (captura del File), el GI maneja value/validación/preview; NUI especializa el trigger con
`n-upload`.
