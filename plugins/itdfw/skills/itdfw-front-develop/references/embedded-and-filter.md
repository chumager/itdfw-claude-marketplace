# Embedded + Filtros (sub-formularios anidados y el contexto Filter)

## Principio: el back marca, el front pide LAZY

Sub-documentos (`Subdocument`/docArray) y refs expandidos en filtro NO viajan con su estructura
embebida: el back manda solo la MARCA (`component:"Embedded"` + el schema/ref), y el componente
pide sus propios inputs por la punta cuando los necesita. El back corre en RPi → cero fetch hasta
que se abre el sub-form. (Excepción: la config `getDefinition` pide el árbol completo con
`recursive:true`; ahí los inputs SÍ vienen — ver dualidad abajo.)

## ItdForm es HOJA — no se poluta con lazy

`ItdForm` ("me pasas la shit o no pinto nada") cumple doble rol: form principal Y embebido. Por eso
NUNCA lleva fetch lazy — al form principal se lo da `formBundle`. El intermediario es **ItdEmbedded**.

## ItdEmbedded — GF auto-contenido (extends GenericForm)

`ItdEmbedded` **extends GenericForm** (mode `"input"`): un GF usado como GI (sus errores se reportan
como una entrada al GIW del padre; el layout lo da el n-grid del GF, ver [layout-columns.md](layout-columns.md)).
Lo ÚNICO especial es la **ventaja operativa de auto-contención**: *"si no me mandas los datos, yo los
pido"*. Cuando los inputs no llegan embebidos (no provistos por recursive/config), el componente los
busca solo por su punta `form<ContextType>?field=` (o `model=ref`). Es data-aware como Select/Subset.

Esto es la diferencia operativa clave vs un form crudo: el dev puede mandarle el árbol completo
(`input.inputs`) **o no mandar nada** y el embedded se auto-abastece. Mismo componente, dos modos,
cero configuración extra del dev.

🔴 **`childrenLazy: true`** (2026-07-13): el Embedded declara que sus HIJOS emiten al blur SIN ser lazy
él — su canal de subida queda libre (solo recibe `valueUpdate`). Compone recursivo solo (embedded L2
gratis). JAMÁS `lazy` en el Embedded mismo (gatearía su assignVSR → bloquea el flujo). Detalle:
value-pipeline.md §NESTED-LAZY.

**Dualidad del fetch** (setup PROPIO — el setup NUNCA se hereda, se escribe a mano):
```js
setup(props) {
  const {input = {}} = props;
  if (input.inputs?.length) return {};                  // ya vienen (config recursive) → cero fetch
  if (["view","detail","plain"].includes(props.viewType)) return {};  // grilla/display → no fetchea
  const {getForm, model} = useBackend(props);
  if (input.ref) return {fetchedInputs: getForm({model: input.ref})};  // ref → model del referenciado, sin field
  if (!model) return {};
  return {fetchedInputs: getForm({field: input.name})};  // embebido → model transitivo + field
}
data() { return { mode: "input" }; }
watch: { fetchedInputs(v) { if (v?.length) this.innerForm = v; } }  // fetch resuelve → puebla innerForm
created() { if (!this.innerForm?.length && this.fetchedInputs?.length) this.innerForm = this.fetchedInputs; } // cache-hit
```
`getForm` usa el **contextType transitivo** para elegir la ext: Create→formCreate, Update→formUpdate,
Filter→formFilter. El GF watchea `innerForm` → recompone `localForm`. El componente de datos SÍ se
hace cargo de los datos faltantes (los pide), pero NO llama a `form` — transforma `innerForm` en el
setup/created, nada más (decisión de diseño: el componente de datos abastece su propio inner, no
orquesta el form padre).

### Matriz operacional

| | embebido (sub-schema) | ref |
|---|---|---|
| **input** | `form<Context>?field=<name>`, model transitivo | DEUDA (editar el referenciado directo — raro; cobertura lateral: crear+seleccionar) |
| **filter** | igual, contextType Filter → formFilter | `model = input.ref`, sin field |

`mode="form"` NO existe como prop de GF (es DATA) — el wrapper de fila pasa la señal; para forzar
el form standalone dentro del drawer se pasa `input` + `form` por separado (no `input.inputs`).

## El contexto Filter — ItdFilter y su wrapper especial

`ItdFilter` es un GF con `viewType="filter"` propagado a los hijos (lazy, sin validación — un filtro
parcial es válido). **`contextType:"Filter"`** lo decide quien lo instancia (ej. ItdGrid en su drawer)
y viaja transitivo pabajo → cada Embedded anidado pide `formFilter` (no formCreate) y re-propaga el
contexto → la recursión por refs cierra sola a cualquier profundidad (Request→responsable(User)→
profile(Profile)…). `View` es el único contextType read-only; Filter es editable.

**Punta normalizada**: el filtro tiene UNA sola punta — `formFilter` (el alias `tableFilter` se
eliminó). El front consume `formFilter` siempre; un ref en el filtro llega como `component:"Embedded"`
(sub-filtro lazy, sin eager). No hay dos caminos (grilla vs form) — coherencia de una punta.

**Ancho del drawer (`filterWidth`)**: el drawer del filter y sus sub-drawers anidados se dimensionan
con `filterWidth` (cascada -10px por nivel, vía provide/inject). Ver [layout-columns.md](layout-columns.md).

**Wrapper especial `GenericInputWrapperFilter` (GIWF)**: en NUI, cuando un input del filtro es un ref
expandido (`component:"Embedded"`), en vez de renderizar el sub-form inline muestra un **botón
activador** que abre un `n-drawer` con el sub-filtro adentro (anidación estilo Finder, cada nivel su
drawer). Fronts sin drawer usan el fallback core (inline). El dev que arma un front nuevo puede
necesitar **su propio Embedded y/o su propio wrapper de filter** — son los dos puntos de extensión
del contexto Filter.

## Layout label↔input (relación, NO interno del componente)

El `horizontal` del INPUT es para su layout interno (checkbox/radio en fila vs columna) — NO decide
su relación con el label. Esa relación la decide el FORM (global `specs.horizontal`/`config.horizontal`)
→ el GIW la implementa: el GI vive DENTRO del `<label>` (asociación implícita) que es flex container,
`row` (horizontal) o `column` (vertical). El input va en un div `flex:1` (sin esto los select colapsan
al contenido). En la práctica el horizontal casi no se usa (nav con auth/search inline sería el caso).
