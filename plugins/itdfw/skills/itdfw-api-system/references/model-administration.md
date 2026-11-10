# Administración de Modelos

Contrato declarativo back↔front para administrar entidades (CRUD + listado paginado + form de detalle). Documenta las puntas del contrato, qué espera el front, cómo extenderlo o emularlo. **El front no sabe ni le importa cómo el back honra las puntas** — solo que el shape se respete.

## Vista vs Form — contrato cerrado vs abierto

| Componente | Tipo | Contrato |
|---|---|---|
| **View** | Stateful dinámico (filtro/page/sort/pageSize) | **Cerrado**: 5 puntas eager + 2 dinámicas con mutate |
| **Form** | One-shot estático (pide datos, opera, envía) | **Abierto**: firma `{type, model, method}` parametrizada |
| **ItdRowDetail** | One-shot estático (subset por IDs) | **Cerrado**: 2 puntas fijas |

**Sobre la firma de Form**: los nombres `Create`, `Update`, `Register`, `Profile` son **subfirmas operacionales convencionales**, NO firma base del contrato. Mañana un dev declara `type: "Audit"`, `method: "GET"` y el contrato lo soporta sin tocar el FW — solo necesita que la punta `formAudit` exista en el back.

## setRoute: lo importante son los props, no los children

`mongoosePlugins/FrontEnd.js setRoute` genera el árbol de routes del front desde el schema:

- **Modelo administrable completo** (default): children `View` (root), `Upload`, `Create`, `Register`, `Update/:id` — convención de árbol estándar.
- **Ruta directa minimal** (caso `myProfile`): override completo via `options.route`, sin children — una sola entrada con `component: "Form"` y props inyectados.

Lo que el FW requiere mínimamente: **los props correctos lleguen al componente target**, NO la estructura del árbol. Children es convención del caso "administrable completo", no requisito.

**Inyección de props**: static via `props: {model, type, method}`, NO `props: true`. Esto bloquea route.params para los campos del contrato. `id` viene de `useRoute().params` cuando aplica (caso Update).

**Cascade de meta padre→child**: meta declarado en parent route se propaga, children pueden overridear. Crítico: `meta.method` viaja al Form y dispara el branch `formBundle` para pedir `formData` (PUT) vs no-op mock (POST).

## Las puntas del contrato — por componente

**View** consume vía `setup(props)` con 9 puntas en el return:

```
{
  fields, canCreate, canUpload, specs, filterForm,  // 5 refs eager
  itemsRes, itemsMutate,                            // ref + fn (dinámico)
  countRes, countMutate                             // ref + fn (dinámico)
}
```

Endpoints back: `tableFields`, `formFilter`, `tableSpecs`, `checkCreate`, `checkUpload`, `tableData`, `tableCount`. Todos GET-cacheables vía SWR.
La definición del filtro de una grilla es `GET /APP/AAA/<Modelo>.formFilter` (no existe `tableFilter`): por campo
filtrable entrega `path`, `label`, `type`, `filter` (`true` · `"multiple"` · `"between"`), `popupTable` y `options`. `checkCreate`/`checkUpload` son espejos GET con `req.changeMethod` al verbo real.

🔴 **El filtro de `tableData` viaja como `filter[campo]=valor`** (`?filter[to]=<id>`, `?filter[status]=Pagada`; el MCP
`query` lo serializa solo). **Un `?campo=valor` pelado se IGNORA en silencio y la grilla responde 200 con TODO** — no
hay error que lo delate. Caso real (2026-09-04): un helper de test filtraba `?to=<id>`, recibía la fila de otro
y daba por existente lo que faltaba crear; el rojo apareció tres casos más allá. Otros params de primer nivel:
`perPage`, `currentPage`, `sortBy`, `sortDesc`, `_id` (uno o arreglo), `count`, `pageCount`.

**Form** consume vía `setup(props)` invocando `formBundle({model, type, id, method})` con 3 puntas:

```
{form, specs, value}   // solo refs, SIN mutate (one-shot)
```

Endpoints back: `form<Type>` (verbo según method), `formSpecs`, `formData` (solo si `method === "put"`). Espejos GET para SWR-cache opt-in.

**ItdRowDetail** consume `{model, ids}` con 2 puntas:

```
{fields, items}
```

Endpoints: `tableFields`, `tableData` con filtro `{_id: idsArr}`.

**Mutaciones** (axios directo, no cacheables HTTP): `setForm(model, data, "post"|"put")` → `POST/PUT /APP/AAA/<Model>.json`. `deleteRows(model, ids)` → `DELETE /APP/AAA/<Model>.json?_id[]=...`.

## req.changeMethod: espejos GET opt-in para SWR-cache

Patrón de espejo: declarar un handler `GET` que redispatchea al verbo real:

```js
GET: {
  formUpdate(req) { return req.changeMethod("PUT"); },
  formData(req)   { return req.changeMethod("PUT"); },
  formSpecs(req)  { return req.changeMethod("PUT"); }
}
```

`req.changeMethod(verb)` muta `req.requestedMethod`, preserva `req.method` original para 304 IETF, redispatcha al handler del verbo destino. **Permisos respetados**: auth corre contra el verbo destino, no contra el GET.

**Cuándo declarar espejos**:
- ✅ El front quiere SWR-cachear el resultado (cache + revalidation via Service Worker).
- ❌ Mutaciones side-effect-ful (POST/PUT que mutan state real — el espejo GET solo aplica a lecturas declarativas).

**Espejos = optimización opt-in, NO contrato base.** Si el dev quiere forzar request directo (bypass cache), simplemente no declara el espejo. El smart-cache strategy futuro (`claude-docs/TODOs/ideas/01-SMART-CACHE-STRATEGY.md`) hace esto automático según headers RFC 5861 — los espejos quedan vestigiales en ese mundo.

## Filtro de emisión: `send` vs `hidden` (qué VALUE viaja al front)

`hidden` y `send` son atributos **ortogonales** del campo, y aplican a **direcciones distintas**. No los mezcles:

| Atributo | Dirección | Qué controla |
|---|---|---|
| `hidden` | infra + front→back | qué inputs muestra el form (por contexto/global) Y qué se acepta al guardar |
| `send` | back→front | si el **VALUE** del campo viaja al front |

**Lo que declara el dev en el campo**:
- `send: false` → el value **NO viaja** al front (password, secretos). El input **sí se muestra** (para escribir uno nuevo), pero su value no baja.
- `send: true` → **OVERRIDE**: el value viaja **incluso si el campo está `hidden`**.
- sin `send` → decide el `hidden` del contexto.

🔴 **Al guardar, los campos ajenos se OMITEN EN SILENCIO, a propósito** (gap #19): un campo `readonly`,
`disabled`, `hidden` para ese contexto, o que no existe en el schema, **se descarta sin error**, para no darle pistas
a quien busca agujeros. Lo que SÍ vuelve son los fallos de **lógica, permisos u operación** (`HTTPError`). Si "guardé
y no pasó nada", el silencio es deliberado para esa clase de campos y el problema es otro (caso real 2026-09-15:
un 413 por tamaño del cuerpo, horas persiguiendo el silencio equivocado).

**Las dos direcciones (no confundir)**:
- **ENTRADA** (front→back, guardar) → filtra **solo `hidden`**. El password (`send:false`) **SÍ se guarda** (es además la puerta anti-escalada de `level`). Los `pick*` de infra (`pickView`/`pickCreate`/`pickUpdate`/`pickProfile`) sirven a esta dirección.
- **SALIDA** (back→front, emitir value) → `send` es **override de `hidden`**. El FW centraliza este filtro en **`pickData(ctx, req)`** (FrontEnd.js), que los callers de emisión usan (`tableData`, `formData` PUT, `myProfile`). Recibe el ctx escalar del contexto destino.

> 🔴 Si declaras `send:false` y el value igual llega al front, el caller de emisión no está usando `pickData` (usa un `pick*` de infra, que solo filtra hidden). Mecanismo + tabla de verdad: `claude-docs/architecture/back/output-send-filter.md` (ex-Hallazgo #87).

## 3 modos nativos de implementación del contrato

El mismo contrato front lo honran 3 backs distintos. Esto ES la potencia del modelo declarativo: el front no necesita saber cómo el back implementa.

| Modo | Estructura | Datos | Tradeoff |
|---|---|---|---|
| **A — Mongoose nativo** | Schema con plugins genera todas las puntas automático (FrontEnd.js plugin) | MongoDB | Default del FW, cero boilerplate |
| **B — Schema declarativo + DB externa** | Schema Mongoose declara estructura (campos, tipos, virtuals), nunca recibe datos | Custom handlers contra MySQL/PostgreSQL/API externa | Extensibilidad total; sync manual del schema con la tabla externa |
| **C — Sin modelo, puntas directas** | Endpoints hardcoded responden las puntas estructurales | Cualquier fuente (auth user, request externo, mock) | Cero modelo persistente; "puntas funcionales" no entidades |

**Modo A** = lo natural cuando administras una entidad CRUD. **Modo B** = adapter sobre legacy DB sin migrar datos. **Modo C** = patrón `myProfile` (estructura del user logueado, no entidad).

## Patrón model-virtual — myProfile

Caso paradigmático de Modo C montado encima de Modo A (hereda User para estructura):

```js
// User.js options.route — override completo, sin children
route: {
  title: "Mi Perfil",
  name: "profile",
  props: {type: "Update", model: "myProfile"},
  component: "Form",
  meta: {model: "myProfile", method: "PUT"}
}

// User.js options.API — endpoint virtual
"AAA/myProfile": {
  PUT: { /* update del propio user */ },
  GET: {
    formUpdate(req) { return req.changeMethod("PUT"); },
    formSpecs(req)  { return req.changeMethod("PUT"); },
    formData(req)   { return req.changeMethod("PUT"); }
  },
  isAnonymous: "auth",
  hidden: true
}
```

Claves:
- `props.model: "myProfile"` (NO `"User"`) — Form pide a `myProfile.form<Type>`, no a `User.formUpdate`.
- `meta.method: "PUT"` — dispara `formBundle` a pedir `formData`.
- Espejos GET obligatorios porque el front SWR-cachea formUpdate/formSpecs/formData.
- `isAnonymous: "auth"` — cualquier user autenticado opera SU perfil sin permisos sobre Model User.

## Extender View y Form respetando el contrato

Un dev puede pisar `setup()` en una extensión. **Requisito**: el return debe mantener la firma del contrato base.

**View extendido — items desde fuente custom**:

```js
import {ref} from "vue";
import View from "fronts/itdfw-naiveui/src/views/View.jsx";

export default {
  extends: View,
  setup(props) {
    const itemsRes = ref([]);
    const itemsMutate = ({params} = {}) => {
      myCustomFetcher(params).then(data => itemsRes.value = data);
    };
    const countRes = ref(0);
    const countMutate = () => { /* ... */ };
    // + el resto del contrato (fields, canCreate, canUpload, specs, filterForm)
    return {fields, canCreate, canUpload, specs, filterForm,
            itemsRes, itemsMutate, countRes, countMutate};
  }
};
```

ItdGrid no sabe ni le importa que items vengan de WebSocket / mock / DB externa. Solo necesita el shape `{itemsRes: Ref, itemsMutate: fn}` correcto.

**Features fuera del contrato**: si el dev necesita extras (ej. Form con mutate dinámico), agrega al return propio + sobrescribe métodos donde se use. NO obliga al contrato base. Una sobrecarga que ROMPE el contrato (no retorna `form`/`specs`/`value` en Form) hace que el render del padre reviente.

## Patrón `toRef` para methods que retornan refs

Cuando un method retorna un ref reactivo a un componente hijo, **no puedes retornar `this.refKey` directo**. Vue 3 auto-unwrappea refs top-level del setup return en `this`; un method que retorna `this.refKey` devuelve el **value snapshot** (no el ref). El hijo recibe snapshot, no se entera de mutaciones posteriores del ref subyacente.

**Solución**: `toRef(this, "key")` convierte el value reactivo en ref pelado conectado al proxy. El caller recibe ref reactivo y el binding vive:

```js
import {toRef} from "vue";

methods: {
  items(ctx) {
    this.itemsMutate({params: this.ctxToParams(ctx)});
    return toRef(this, "itemsRes");  // ref reactivo, no snapshot
  }
}
```

Patrón aplicado en `fronts/itdfw-naiveui/src/views/View.jsx` con items/count para el contrato segmentado.

## Checklist: implementar un modelo de administración nuevo

**Modo A — Mongoose nativo**:
- [ ] Schema con campos y tipos.
- [ ] Plugins core (FrontEnd) registran las puntas estándar automático.
- [ ] Permisos via `Model.canSee` (auto-CRUD gateado).
- [ ] (Opt-in) Espejos GET si necesitas SWR-cache en mutaciones.

**Modo B — Schema declarativo + DB externa**:
- [ ] Schema Mongoose declara estructura (mismos campos que la tabla externa).
- [ ] Override `options.GET.tableData`, `options.GET.tableCount`, `options.PUT.json`, etc. con handlers contra DB externa.
- [ ] Mantener `tableFields`/`tableSpecs`/`formCreate`/`formUpdate` desde el schema (FW los genera).
- [ ] Sync manual del schema con cambios de la tabla externa.

**Modo C — Sin modelo, puntas directas (myProfile-style)**:
- [ ] `options.route` con override completo (sin children).
- [ ] `props: {type, model, method}` static + `meta.method` correcto.
- [ ] `options.API["<key>"]` con verbo real + espejos GET necesarios.
- [ ] `isAnonymous`/`auth` propio (no hereda del Model padre).
