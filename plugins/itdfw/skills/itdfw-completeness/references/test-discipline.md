# Test discipline — green/red, onDev, e2e, validación externa

> 🔴 **Quién escribe qué (desde 2026-11-15):** el e2e es de QA; quien implementa entrega headless y el scope del
> e2e en prosa (SKILL.md, § "Quién prueba qué"). Donde esta referencia dice "el e2e del plugin" o "el spec del
> componente", describe **cómo es** ese e2e (estructura, parámetros, login, capturas); **lo escribe y lo corre QA**.
> Los specs que ya viven en `plugins/*/test/e2e` y `fronts/*/test` siguen donde están y son de QA.

## Green + Red (no solo green)

Un test que solo prueba el camino feliz miente por omisión. El patrón del FW:
- **GREEN**: el patrón correcto **pasa** (parse válido, aritmética, formato, nullish/FCC, idempotencia…).
- **RED**: lo que DEBE fallar **falla** (PLR en estados imposibles, deps faltantes, inputs inválidos → throw).

Molde vivo: `itdfw-mongoose-types/templates/*.test.js` (Complex/Percentage/Money/Place — green+red ejecutables).
Para lógica pura (un VO, un helper) → test `node` directo con `node:assert`, aislado, sin levantar el FW.

## 🔴 Tests que NO se borran — gateados por `onDev`

La regla vieja "instrumentá con logs/tests y limpiá al final" tiene una versión mejor: **no borres, gateá**.
Los tests/checks que valen como red de seguridad **viven en el código**, condicionados a `onDev` (global del
FW) → corren en desarrollo, son no-op en producción. Cero costo en prod, cero pérdida de la red al terminar.

```js
/* global onDev */
if (onDev) { /* test/assert/instrumentación que sobrevive sin ensuciar prod */ }
```

Aplica al patrón TDD e2e de un FWPlugin (correr su suite en modo `onDev`). Lo efímero de verdad (un log de
debug ruidoso para cazar UN bug) sí se quita; lo que protege un invariante se queda gateado.

## 🔴 Los DATOS de la prueba sí se borran; lo construido queda a la vista

El código de la prueba queda (arriba); lo que la prueba **siembra** no. Son dos cosas distintas:

| | Las pruebas automáticas | La vitrina |
|---|---|---|
| Para qué | certificar el contrato | que el dueño VEA lo construido: el componente operando, sus validaciones, sus bordes |
| Ciclo | se levanta, se siembra, se prueba y se borra **por la API** (el plugin `delete`) | queda operando en un site conocido, con datos de muestra que no se borran |
| Dónde | el site que corresponde al módulo | el site del consumidor o una pantalla de banco del módulo |

Cómo se borra lo decide el **MODELO**, no la prueba: es un guard de arquitectura y nadie lo pide desde afuera.

- Un modelo real queda con su soft delete (`deleteMode` por omisión).
- Un **modelo que existe solo para probar** (onDev) declara **`deleteMode: "hard"`**: lo que la prueba borra
  desaparece, sin filas `active: false` acumulándose.
- Una **colección que existe solo para la prueba** se elimina entera (`drop`) al terminar: no quedan colecciones
  vacías o llenas de borrados.
- Un fixture que el sistema compila o ejecuta al arrancar y que está roto a propósito se desactiva en el `after`.

**Todo reporte de cierre trae la URL de la vitrina y qué mirar ahí.** Sin vitrina, "verde" es fe: el dueño no tiene
dónde mirar.

## 🔴 Prueba de BACK REAL de un custom type (no la clase aislada)

Un VO probado solo con `node:assert` valida la **clase**, NO el custom **type**. Para el back real,
enchufá el VO en mongoose y probá el flujo completo: `cast` (con doc), `toBSON`, `toJSON`. Sin levantar el
FW — replicá el caster de `#loadTypesFromObject`:

```js
import mongoose from "mongoose";
const {Schema, SchemaType} = mongoose;
// mini-caster (réplica de #loadTypesFromObject: cast > class > extends > super)
function loadType(db, type, def) {
  const Base = def.extends ? (db.Schema.Types[def.extends] ?? SchemaType) : SchemaType;
  const k = {[type]: class extends Base {
    constructor(key, o){ super(key, o, type); }
    cast(...a){
      if (def.cast) return def.cast.apply(this, a);
      if (def.class){ const [v]=a; if (v instanceof RegExp) return v; if (v==null) return null; if (v instanceof def.class) return v; return new def.class(...a); }
      return super.cast(...a);
    }
  }}[type];
  for (const [n,val] of Object.entries(def.options ?? {})) k.set(n, val);
  k.instance = type; db.Schema.Types[type] = k; return k;
}
loadType(mongoose, "MyT", {class: MyVO});
const M = mongoose.model("TMy", new Schema({f: "MyT"}));
const d = new M({f: <input válido>});
// GREEN: d.f instanceof MyVO · d.f.toBSON() · d.f.toJSON() · idempotente (reasignar la instancia) · null→null
```

🔴 **mongoose DIFIERE el `CastError`**: el cast que lanza dentro de `new Model({f: <malo>})` **NO propaga
el throw** — lo guarda para `validateSync()`/`save()`. ⟹ probá el **red** con `schemaType.cast(malo)`
directo (lanza), **o** `new M({f:malo}).validateSync().errors.f` (existe). Esperar `throw` en la
construcción del doc te da un falso "no rechaza". Material vivo: `tests/mongoose/loadtypes-class-extends.test.js`.

## 🔴 VO transversal → el e2e cubre BACK **Y** FRONT, y vive EN el plugin

Un Value Object existe para correr la **misma clase back↔front**. Por eso un e2e que solo prueba el back
(mongoose headless) valida **la mitad** — "e2e" pasa a ser mentira por omisión. El e2e de un VO/FWP
transversal DEBE cubrir las dos patas:
- **back**: el cast/toBSON/toJSON/pub-sub en mongoose real (lo de "prueba de back real" arriba).
- **front**: el componente (`Itd<VO>`) usando **esa misma clase** — parse/format/serialize, reaccionando al
  estado del root (`rootBus._dep`). Playwright sobre el test-form, o al menos la clase ejercida en el front-runtime.

🔴 **Y el test VIVE EN EL PLUGIN** (FWP), gateado por `onDev` — NO suelto en `tests/`. El FWP trae su propio
TDD e2e (patrón #93): el plugin es la unidad distribuible, su prueba viaja con él. Un test del VO en
`tests/mongoose/` es válido para iterar el DISEÑO, pero el done del FWP exige la suite e2e (back+front)
contenida en el plugin.

## 🔴 Y el test del CORE vive en `tests/back/` — nunca en un plugin

La regla inversa de la anterior. Lo que prueba el **framework** (AAA, `changeMethod`, `Profile.canSee`, parsers,
multer, timezone, wellKnown…) va en **`tests/back/`** del monorepo, porque es lo que corre en el release del back.
Un test del core escrito dentro de un plugin **no corre cuando se publica el back**: es un test que existe y no
protege nada (jcmunoz 2026-09-16, tras encontrar el espejo `checkUpdate` probado desde un plugin de producto: *"un
plugin que prueba cosas del core es un total sinsentido"*).

Cómo se escriben, para que el gallinero se ordene solo:

- **`node:test`** (Node ≥ 22 basta: `describe/it`, `before/after`, `skip`, `mock`, reporters `spec|tap|junit|dot`).
  Nada de scripts que impriman `OK/FALLA`: se afirma con `node:assert/strict`.
- **El runner es `tests/back/index.js`**: `node index.js -H <URL COMPLETA> -U <user> -T <token> [-P <password>]
  [--reporter junit] [patrón…]`. Deja `ITDFW_HOST/USER/TOKEN/PASSWORD` en el entorno y corre los `*.test.js`.
  🔴 `-H` es la **URL completa** (`https://<host>:<puerto>`): el test no decide ni deduce nada de
  red, así se prueba igual un sitio local, uno por nginx o uno remoto.
- **`tests/back/lib/site.js`** entrega `admin()`, `as(user, token)`, `url(path)`, `request()`, `json()`. El
  **transporte** (headless client, `fetch`, curl, Playwright) lo elige cada test; el runner no sabe de eso.
- 🔴 **Browser = spec programático de `@playwright/test`** (`npx playwright test <ruta> --reporter=line`), que vive
  con la unidad (`plugins/<x>/test/e2e/`, `fronts/itdfw-naiveui/test/`, fuera del tarball). **Nunca un MCP de
  browser** (`plugin_playwright`, `playwright-headless`): cada llamada trae la página entera al contexto y no deja
  nada reutilizable. Patrón: `fronts/itdfw-naiveui/test/menu.spec.js`. La consola del browser se afirma dentro
  del spec (`page.on("console")`).
- **Fixtures del core**: puntas `onDev` en `back/itdfw/src/SITE/APP/test.js` (`test/exec`, `test/anonFn*`,
  `test/readonlyUser`). Nacen perfiladas: el test las asigna al admin del runner con `MCP/assignFunction` antes de
  usarlas. Sin modo desarrollo responden 404 y el caso se salta con `ctx.skip`, no falla.
- 🔴 **Un modelo o punta de prueba de un plugin tiene DOS cosas, ORTOGONALES** (jcmunoz 18-sep-2026):
  1. **Su existencia** la decide `onDev`, y **la decide el propio archivo** (ver "El archivo se hace cargo"
     abajo): quien lo enchufa (`index.js` del plugin, la carpeta del site) no condiciona nada. En prod no
     existe, no hay que limpiarlo.
  2. **Su acceso** lo decide la prueba: si la prueba es anónima, `isAnonymous: true` (fuera de dev el archivo ya escapó); si necesita un usuario,
     **no lleva `isAnonymous`** y el e2e **se loguea de verdad**: el spec de Playwright hace el login por la
     interfaz o por `POST /APP/AAA/checkLogin.json` con usuario y clave leídos del entorno (como el runner de
     `tests/back`: `-U`/`-P` → `ITDFW_PASSWORD`), nunca escritos en el spec.
  🔴 **Un cajarito nunca le pide a jcmunoz que "pruebe logueado" a mano** (gap #34, translate 18-sep). Y el
  bloqueo del harness al mandar una contraseña existe solo con los **MCP de browser**, que no se usan para
  probar (rule `e2e-programatico-nunca-mcp`); en un spec por consola el login es código y no lo frena nadie.
  🔴 `TestAuth` (`FWPlugins/TestAuth.js`, header `x-test-auth`) **no es la vía**: es el aportante de juguete que
  el TDD de la cadena de autenticación usa para probar la cadena misma (`TDD-auth-chain.md` filas 1.11, 1.14).
  No se usa en pruebas de plugins.
  🔴 **El esqueleto NO se diseña: se copia del template del skill `itdfw-fwplugin`**
  (`assets/fwplugin-template/`): `mongooseSchema/MyTypeTest.js` (el type en los 4 niveles, `isAnonymous:
  true`, con el retorno rápido en su primera línea), el `index.js` que lo enchufa sin condición y
  `test/e2e/mytype.e2e.spec.js` (Playwright por consola, sin login, se salta si el modelo no está). Se renombra
  y se rellena; si la prueba necesita un usuario, se quita `isAnonymous` y el spec se loguea como dice arriba.

### 🔴 El archivo se hace cargo de su existencia (jcmunoz 9-oct-2026)

Si el origen de una pieza de prueba es un archivo, **ese archivo decide si existe**, no quien lo importa. El
escape es rápido y va donde el archivo entrega su valor:

| El archivo exporta… | Dónde va el escape | Forma |
|---|---|---|
| una **función** (schema: el motor hace `func.call(this)`) | primera línea de la función, **antes del `this.init`** | `if (!onDev) return {};` |
| un **objeto** (API por archivo, types `{types, postLoad}`, plugins) | en la raíz del módulo | `export default onDev ? {...} : {};` |

- El schema **no** se apaga con `noModel: !onDev` / `noAPI: !onDev`: eso crea el schema igual y deja el warn
  "schema creado sin generar modelo" en cada arranque de prod. Sin `init` no hay schema, ni modelo, ni warn.
- Un objeto no se puede escapar desde adentro: por eso el schema es función (necesita su `init` declarativo al
  inicio) y el resto escapa en la raíz.
- Ganancia: el `index.js` de un plugin solo ensambla; nadie fuera del archivo sabe cuál es de prueba.
- `onDev` es global (`lib/myutils.js`) y existe cuando el back carga schemas, puntas y types. Un archivo que se
  evalúe antes (el `index.js` de un plugin, importado desde `.itdfw.js`) lo calcula local:
  `process.env.NODE_ENV !== "production"`.

```js
/* global onDev */
function Schema() {
  if (!onDev) return {}; // first line: no init, no schema, no warning in production
  const {db} = this;
  this.init("MyTypeTest");
  …
  return {MyTypeTest};
}
```

Casos vivos: `anonGate.test.js` (las tres formas de `isAnonymous`), `permissionMirror.test.js` (un perfil con solo
GET recibe 403 de `checkUpdate/checkCreate/checkDelete/formUpdate/formData`; el bug estuvo de mayo a septiembre
2026 porque el único test del espejo se hacía con perfiles completos).

## 🔴 La prueba REAL de un type: modelo MULTINESTED anónimo + onDev

Para probar que un type (VO o no) aguanta DE VERDAD —en **form Y grilla**— se usa un MODELO de prueba que
ponga el type en los **4 niveles de anidación**:
- **root** (campo directo del modelo),
- **array** (array simple del type),
- **embedded** (sub-schema con el type — objeto único),
- **docArray** (array de sub-schemas con el type).

🔴 **Por qué los 4 (no negociable)**: es la ÚNICA forma de verificar que el type corre en todos los
contextos reales. El front renderiza distinto cada nivel (form vs grilla, root vs nested) y cada uno
ejercita el pipeline de forma diferente (`toInput`, cast, `ownerDocument()` que sube al root, propagación
de eventos a profundidad). Probar solo el root es probar el caso fácil y declarar Done sobre la mitad.

🔴 **El modelo es ANÓNIMO (`isAnonymous: true`) y su creación DEPENDE de `onDev`** → en producción NO
existe (se autodestruye, no hay que limpiarlo):
el escape vive en el propio schema (`if (!onDev) return {};` antes del `init`, ver "El archivo se hace cargo"),
y el `index.js` lo enchufa sin condición.
Así el done de un type/VO se mide contra la REALIDAD (4 niveles × form/grilla × back/front), y la prueba
desaparece sola al pasar a prod. Para un VO N2 (depende de un valor del root, ej. Currency) este modelo es
DOBLEMENTE necesario: prueba que el virtual ascendente (`ownerDocument()._dep`) y la propagación del cambio
(pub/sub) alcanzan los 4 niveles — no solo el root.

🔴 **NESTING × RESTRICCIONES — el cruce ORTOGONAL obligatorio** (gap cazado 2026-07-06, jcmunoz): el
modelo multinested prueba los NIVELES, pero las RESTRICCIONES del campo (`required`, `min`, `max`…) son
definiciones INDEPENDIENTES del nesting — probarlas solo en el root deja el cruce sin cobertura (el
CurrencyTest original tenía min/max en el root y los nested PELADOS). El modelo de prueba DEBE cruzar:
- **root × restricción** (ej. `home: {type: "Address", required: true}`),
- **root × SIN restricción** (el control: vacío debe GUARDAR),
- **nested × restricción** (el sub-schema con `required`/`min`/`max` INTERNOS — embedded Y docArray).
Qué restricciones aplican depende del type: Currency = min+max+required (aplica FUERTE); Rut/Address =
solo required. Molde vivo: `plugins/address/mongooseSchema/AddressTest.js` (matriz en el header). La
batería green/red se corre HEADLESS como test de back (`node:test` contra las puntas del site: POST
caso válido / sin el required / violando la restricción nested) ANTES del e2e de browser — más barato
y caza la mitad de los bugs. Un test que queda, no llamadas sueltas a mano por el MCP: esas no se
repiten (ver "Verificación LARGA" abajo y la rule de e2e programático).

## 🔴 INFRA de prueba ≠ SCRIPT e2e (no confundir)

Son dos artefactos distintos:
- **INFRA** = el modelo multinested anónimo onDev (arriba) → *qué* se prueba CONTRA. Declarativo.
- **SCRIPT e2e** = *cómo* se prueba, automatizado con **Playwright** → un e2e real **NO cuenta con la
  participación del humano**: el agente lo corre solo. Si el test necesita que alguien clickee, no es e2e.

🔴 **El modelo anónimo (`isAnonymous:true`) habilita el e2e autónomo**: sin login/permisos, el script tiene
**acceso DIRECTO al CRUD** → ejerce **crear, ver, editar** (y borrar) datos reales en el front, en los 4
niveles (root/array/embedded/docArray), form y grilla. Eso es lo que prueba que el type aguanta de verdad —
no leer un doc que ya existía, sino el ciclo completo de datos hecho por el script, sin asistencia humana.

**Estructura del e2e en el plugin** (probado con Currency, 2026-07-01): vive en `<plugin>/test/e2e/`:
- `<name>.e2e.spec.js` — el spec Playwright, **parametrizable** por `BASE_URL` (env, default localhost:8080);
  el PATH del modelo (`/APP/AAA/<Model>`) sale de la ruta AAA. Como el modelo es `isAnonymous`, el spec hace
  `goto` directo, sin login.
- `screenshots/` — capturas de los momentos clave (para el análisis / regresión visual).
- `README.md` — pasos registrados + tabla de hallazgos + pendientes. Se **arma explorando primero con el
  Playwright MCP** (registrando selectores/pasos) y luego se destila al spec + al README.
- Ojo: `@playwright/test` debe estar instalado en el repo para correr el spec headless (el MCP usa su propio
  Playwright; el spec del repo no).

## 🔴 Verificación LARGA ⟹ se AUTOMATIZA o no existe (y su número CADUCA)

Si verificar algo exige **dejar todo en modo debug, armar un caso grande y tantear los edges a mano**, esa
prueba **no se va a repetir**. No es pajerismo: un ritual de una hora nadie lo corre dos veces. Y ahí viene
el daño real, que no es no-probar sino algo peor:

🔴 **Una medición vale solo mientras viva el régimen en que se midió.** Se mide bajo unas condiciones, el
sistema cambia después, y el número sigue citándose como vigente. Nadie lo desmiente porque re-medir cuesta
una hora. El resultado es una certeza fósil: creemos que está probado y está probado *otro* sistema.

⟹ **Regla: toda verificación que sea un NÚMERO o un CONTEO se define e implementa como TEST AUTOMÁTICO,
en el mismo momento en que se hace por primera vez.** Nunca se entrega como "lo verifiqué a mano y da X".
El test es lo que ata el número a su régimen: si el régimen cambia, el test se cae ESE día.

Litmus: *¿el resultado de esto es un número, un conteo o un "¿reaccionó alguien más?"* → es test, no ritual.

**Caso fundacional (2026-08-14, #115)**: el over-render del GF se midió a mano al migrar a Vue 3 —con los
stoppers de reactividad puestos— y dio bien. Después se restauró la reactividad con roundtrips completos
(sin ella el flujo quedaba roto) y **la medición no se repitió**: era carísima. Vivió ~un año como verdad
sobre un sistema que ya no era el medido. Lo destapó un `debug` olvidado en un componente, no una revisión:
una tecla en un campo hacía reaccionar a 12 componentes, 32 renders, **106 ms bloqueantes** con 17 campos.
La causa: el render leía el computed `validateSelfValue`, cuyo getter **clona** para ser comparable — y
clonar lee TODAS las llaves, así que el render quedaba dependiente del objeto entero en vez de su llave.

**La automatización que correspondía desde el principio** (barata, con lo que ya existe): el modelo
multinested anónimo `onDev` ya da el form grande; los logs ya dicen QUIÉN reaccionó. Un spec Playwright
que tipea UNA tecla en un campo y **cuenta los componentes que reaccionaron** convierte la hora en
segundos, y de paso cubre el crecimiento (agregar campos no puede volver a degradar el tipeo en silencio).

Aserción canónica: **una tecla en el campo X ⟹ reacciona X y nadie más.**

## e2e / validación real

- **Front**: Playwright sobre el test-form / la vista real (no "se ve bien en mi cabeza"). Render por cada
  `mode`/`viewType`.
- **Back**: datos reales por la punta real (no un mock que confirma tu sesgo).

## 🔴 El "Done" no se da sobre tu propio testing

Lo que vos probás demuestra que **tu modelo mental** funciona — no que el sistema funciona. El cierre real
necesita validación **externa**: el browser, un dato de producción, otra persona/agente, el e2e. "A mí me
funcionó" no es done; es "mi hipótesis sobrevivió a mi propia prueba". Buscá el contraejemplo afuera.

## Proporcionalidad

No todo necesita la artillería completa. Un helper puro → green/red node y listo. Un FWPlugin con EE/hooks →
green/red **+ memleak** (→ memleak-testing.md). Un componente → e2e. Escalá la prueba al riesgo de lo que
tocaste, no menos (omitir la prueba de un side-effect con retención es el error caro), no más (no montes
mongoose para probar una función de formato).
