# ValidateSelf Integration

GI has `$validateSelf: true` → validateSelf mixin injected via addLoader.

- Watcher on `validateSelfValue` computed: validates + emits
- `$validateSelfValue: "localValue"` — the reactive data key holding the value
- `$validateSelfEmit: true` — auto-emit on change
- Emits: `this.$emit("input", emitter(validateSelfValue))`

## Type-Based Implicit Validators (Auto-Validation)

If `validators[type][type]` exists and `validate` object doesn't already have that key, validateSelf injects it automatically.

```jsx
const {$validator} = Vue;
$validator.addValidator("typeName", "typeName", function() {
  // return "" for no error, or error string (supports Mustache: {{input.label}})
  if (!this.localCurrency) return '"{{input.label}}" requiere moneda';
  return "";
});
```

Second arg = "typeName" (NOT "default") for implicit activation. No need to declare in schema `validate` object.

### Cascaded Auto-Validation (Inheritance Chain)

Auto-validators follow the `addCast` chain — same as class inheritance. If `currency` casts to `number`, BOTH auto-validators run:

```
type="uf" → validators["uf"]["uf"] ✓
  → cast["uf"]="currency" → validators["currency"]["currency"] ✓
    → cast["currency"]="number" → validators["number"]["number"] ✓
      → cast["number"]=undefined → STOP
```

Implementation (validateSelf.js):
```javascript
let currentType = type;
while (currentType) {
  if (validators[currentType]?.[currentType] && !(currentType in validate))
    validate[currentType] = true;
  currentType = cast[currentType] ?? null;
}
```

Each level adds its auto-validator if it exists AND it's not already declared.

### addCast — Type Fallback Mapping

`addCast` maps a type to its parent for validator lookup (3-tier):

```javascript
$validator.addCast("currency", "number");
// getValidator("min") for type="currency":
// 1. validators["min"]["currency"] — if exists, return (specific)
// 2. validators["min"]["number"] — via cast fallback (inherited)
// 3. validators["min"].default — final fallback (generic)
```

Real usage: `currency→number`, `percentage→number`, `range→number`, `uf→currency`.

Currency can override number's validators with currency-specific ones:
```javascript
$validator.addValidator("min", "number", fn);    // generic numeric
$validator.addValidator("min", "currency", fn);  // override for currency
```

## 🔴 Emisión y validación corren por CARRILES DISTINTOS

**SIEMPRE se emite** (gate único: ¿cambió el VSR?) y el error viaja en paralelo
(`validateState`/mensajes) — llega COMPLETO al sendForm, y aguas arriba deciden qué hacer con datos
inválidos. El componente provee todo; jamás gatea su emisión por validación.

`$validateSelfEmitOnError` no existe: sería una rama completa de gateo de emisión
para salvaguardar un solo componente (ItdDatalist) — un invariante replicado. La solución correcta es la
declarativa: Datalist es typeahead LIBRE ("el dato es tuyo, la lista es sugerencia"); si un deploy lo
quiere estricto, se declara un `validate` (valor ∉ options → error) — decisión por validador, no por
capa de emisión.

## Inner Form Validation (Composite Inputs)

For inputs with `tag: "ItdForm"`, the type validator:
1. Calls `this.$refs.input.validateSelf()` → returns `[{name, errors}]`
2. Resolves Mustache `{{input.label}}` with actual labels from form computed
3. Adds consistency checks (range, cross-field)
4. Returns `errors.join(", ")` (empty = no error)

```jsx
// Resolve Mustache templates from inner form errors
const formDef = this.form;
errors.push(
  ...formErrors.flatMap(e => {
    const label = formDef.find(f => f.name === e.name)?.label || e.name;
    return e.errors.map(err => err.replace(/\{\{input\.label\}\}/g, label));
  })
);
```

## Multiple Named Validators

A single input can have multiple validators in its `validate` object. Each key maps to a registered validator:

```js
validate: {required: true, min: 8, minUpper: 1, minNumber: 1}
```

Each validator runs independently via `Promise.map`. All errors are collected and joined.

## validate: false — Inhibir Validación Reactiva

`validate: false` en data, attrs, input, o noValidate inhibe la validación reactiva SIN detener el flujo de emisión.

Guard en watcher VSR (4 fuentes, comparación estricta):
```javascript
if (viewType === "input" && !(validateAttr === false || noValidateAttr || validate === false || validateInput === false))
  await this.validateSelf();
```

- `data.validate = false` → forzado por componente (ej: GF inline de CheckboxGroup)
- `$attrs.validate = false` → pasado como prop desde padre
- `localConfig.validate = false` → viene del input definition
- `$attrs.noValidate` → flag directo

**Ejemplo**: CheckboxGF con `validate: false` en data. Los checkboxes hijos emiten valores, el GF emite su value, PERO no valida ni emite `validateSelfErrors`. Solo el CheckboxGroup padre valida con validators de type array.

## VFG Overrideable en GenericForm

`localVFG` computed en GF con forzado: `data.VFG → $attrs.VFG → fallback localImport("ValidatedFormGroup","lib")`.

```javascript
computed: {
  localVFG() {
    return this.VFG ?? this.$attrs?.VFG ?? (() => localImport("ValidatedFormGroup", "lib"));
  }
}
```

Permite que un GF inline (como CheckboxGF) use su propio VFG sin afectar el VFG global. `renderFormGroup` usa `this.localVFG` en vez de componente hardcoded.

**Ejemplo**: CheckboxGroup con VFG inline que solo renderiza `<label>{checkbox}{text}</label>` sin errores/required.

## Async / Endpoint Validators

Validators can be async. The validateSelf flow already uses `await` for each validator function:

```jsx
$validator.addValidator("strength", "password", async function(minScore) {
  const val = this.validateSelfValue;
  if (!val) return "";
  const response = await fetch(`/API/password-strength`, {
    method: "POST",
    body: JSON.stringify({password: val})
  });
  const {score} = await response.json();
  if (score < minScore) return "{{input.label}} no cumple el nivel de seguridad mínimo";
  return "";
});
```

The validator is **deferred** — if `validateForm` runs before the endpoint responds, the validator's Promise is still pending. `validateSelf` awaits it, so the form blocks until the result arrives.

## Validator with Side Effects (Strength Meter)

A validator can update component data as a side effect while validating:

```jsx
$validator.addValidator("password", "password", async function() {
  const val = this.validateSelfValue;
  // Side effect: update strength score for visual meter
  const {score} = await fetch("/API/password-strength", {method: "POST", body: JSON.stringify({password: val})}).then(r => r.json());
  this.strengthScore = score;  // data property, rendered as color bar
  if (score < this.localInput.validate.strength) return "Contraseña débil";
  return "";
});
```

This avoids a separate watcher — the validator already runs on every value change.

## Regex-Based Validators Pattern

For simple character-class validators (minUpper, minLower, minNumber, minSymbols):

```jsx
function addCharClassValidator(name, regex, msgTemplate) {
  $validator.addValidator(name, "default", function(minCount) {
    const val = this.validateSelfValue || "";
    const matches = val.match(regex) || [];
    if (matches.length < minCount) return msgTemplate;
    return "";
  });
}
addCharClassValidator("minUpper", /[A-Z]/g, "{{input.label}} requiere al menos {{input.validate.minUpper}} mayúscula(s)");
addCharClassValidator("minLower", /[a-z]/g, "{{input.label}} requiere al menos {{input.validate.minLower}} minúscula(s)");
addCharClassValidator("minNumber", /[0-9]/g, "{{input.label}} requiere al menos {{input.validate.minNumber}} número(s)");
addCharClassValidator("minSymbols", /[^A-Za-z0-9]/g, "{{input.label}} requiere al menos {{input.validate.minSymbols}} símbolo(s)");
```

These are registered as "default" type so they work on ANY input type, not just password.
