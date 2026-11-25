# Prefijo Itd + resolveTags / resolveComp / resolveTag

## 🔴 Prefijo `Itd` — distinguir DECLARACIÓN vs NAME del componente Vue

- **`name:"..."` del componente Vue** (export del archivo `.jsx`): **SIEMPRE `Itd*`** sin excepción (`name:"ItdEmbedded"`, `name:"ItdForm"`, etc.). Es identificador interno, mantener prefijado evita ambigüedad y futuras colisiones.
- **DECLARACIÓN en back** (`component:"X"` en schemas): puede ir SIN prefijo si NO colisiona con HTML built-in (`"Embedded"`, `"ArrayAdd"`, `"Range"` están OK). Si colisiona — `"Code"`, `"Select"`, `"Form"`, `"Input"`, `"Button"`, etc. — **OBLIGATORIO** prefijo `Itd*`.
- Razón Vue 3 JSX: render directo usa el string como identificador interno; si coincide con HTML built-in, Vue lo trata como tag nativo y la **reconciliación se rompe en swaps dinámicos** (controllers que mutan `component` post-mount). Vue 2 lo perdonaba porque operaba vía `<component :is=...>` con resolución indirecta.
- Acepta tanto PascalCase (`"ItdCode"`) como kebab-case (`"itd-code"`) — el FW resuelve ambas.
- Ejemplo: una pantalla queda pegada en ItdCode al swap a ItdForm si el back manda `component:"Code"` → Vue veía `<code>` HTML built-in → no destruía+remontaba.

## resolveTags / resolveComp / resolveTag

- `this.resolveTags("button")` — agrega "Tag" suffix automático, lee `this.buttonTag` de data.
- `this.resolveComp(tag)` — method Y global (init.js: `method: true`). Retorna **`{component, native}`**
  (native=true → tag HTML/WC pelado, se usa como string).
- **`resolveTag(name)` (GLOBAL)** — resuelve un componente por nombre. **Dos efectos**: (1) side-effect → **registra el componente GLOBALMENTE** en la app Vue; (2) return → devuelve el componente. Acepta kebab/pascal (`"itdForm"`/`"ItdForm"`).
- 🔴 **EQUIVALENCIA** (en el `init`): `resolveTag(X) === resolveComp(X).component` — resolveTag ES
  literalmente `(...args) => resolveComp(...args).component`. Si solo necesitas el componente (99% de
  los renders), usa `resolveTag`; `resolveComp` solo cuando necesitas el flag `native`.

### El flujo interno de resolveComp (en el `init` — la cascada de resolución)

Por orden, sobre el argumento `component`:
1. **thenable** (Promise) → THROW ("use a function or static import") — una Promise no es componente.
2. **object** → directo (Vue 3 lo pasa por `defineComponent`). Habilita componentes INLINE
   (ej. el GeoSelect de ItdAddress: `component: <objeto>` en la definición del input).
3. **function** → async wrapper cacheable (`defineAsyncComponent` con loading + errorComponent
   `ComponentNotFound` — si el import falla, error inline en vez de petar la app).
4. **string con MAYÚSCULA** (Pascal — nunca colisiona con HTML) → triple lookup en el registro Vue
   (name/camel/Pascal); no está → registra async component (localImport cascade) y lo retorna.
5. **string con guión** (kebab) → `customElements.get()`? → WEB COMPONENT (`{component, native: true}`,
   tag string pelado); no → lookup/registro como el 4.
6. **string lowercase sin guión** → ¿HTML nativo? (createElement no-Unknown) → tag pelado native; no →
   lookup/registro.

Claves: la SEGUNDA petición del mismo nombre sale directo del registro Vue (cero cascada); el registro
siempre PascalCase; import fallido NO revienta la app (ComponentNotFound inline con el nombre pedido).

### 🔴 Componente fijo en render JSX: `resolveTag` directo, NO `components: ci`

**Correcto** (patrón de ItdRowDetail/ItdAction/ItdArrayForm) — resolver en el render, usar la variable:
```jsx
render() {
  const ItdForm = resolveTag("itdForm");   // registra global + retorna el comp
  return <ItdForm form={this.localForm} .../>;
}
```

**Anti-patrón** (Form.jsx, deuda estética): `components: ci("itdForm")` + `<itd-form>` en el render.
- `ci` (en el `init`) = `{Pascal: resolveTag(comp)}` para asignar a `components:`. PERO **en JSX la opción `components` NO se lee** para resolver tags del render. Lo que hace andar el `<itd-form>` es el **side-effect global** de resolveTag (llamado dentro de ci), NO el objeto asignado a `components`.
- ⟹ mecanismo visible (`components:`) ≠ mecanismo real (registro global) → **confunde**: el dev mira `components: ci(...)` y asume Options-API-components, que JSX no usa. Mismo costo que resolveTag directo, peor claridad.
- **Regla**: en render JSX → `const X = resolveTag("itdX")` explícito. `components: ci(...)` solo tiene sentido en un SFC `.vue` real (donde la opción `components` SÍ se lee). En JSX es cruce de funcionalidades que enreda. (`<itd-form>` no "resuelve global por casualidad": resuelve por el side-effect de resolveTag; explicitarlo es lo correcto.)
