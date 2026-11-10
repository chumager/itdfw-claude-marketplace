# Config — valores/políticas por despliegue, dirigidos por datos

El FW tiene un modelo `Config` ("Administración de Configuraciones") que guarda **valores libres
tipados** por despliegue: el código declara la FORMA, el admin de cada despliegue llena el VALOR, y
cualquier modelo/componente lo lee en runtime. Es la pieza que permite que un proceso (etapas de un
flujo, parámetros de negocio) sea **config, no hardcode** — clave en plataformas multi-cliente
(cada tenant define lo suyo sin tocar código).

Cuatro pasos: **definir el shape → crear el valor → leerlo → usarlo**.

## 1. DEFINIR el shape — `db.setConfigDefinition(name, definition)`

Registra qué FORMA tiene el `value` de una config con ese `name`. Se llama en un Schema (async).
La `definition` admite tres formas:

```js
// (a) tipo simple: el value es un escalar de ese tipo
db.setConfigDefinition("maxLoginAttempts", "Number");

// (b) un input con más info: objeto con `.type` (+ atributos del field)
db.setConfigDefinition("supportEmail", {type: "Email", name: "Correo de soporte"});

// (c) un SCHEMA completo: el value es un sub-form (Embedded) con esos campos
const StageDef = new db.Schema({stage: {type: String}, requiresFile: {type: Boolean}}, {_id: false});
db.setConfigDefinition("OnBoarding", {
  stages: {type: [StageDef], name: "Etapas"},
  code:   {type: "Code", name: "Business Logic"}   // una config puede llevar su propia lógica
});
```

La definición TIPA el value: el FW arma el form del value automáticamente (endpoint `getDefinition`).
El `name` es la IDENTIDAD de la config (inmutable: cambiarlo = otra config, delete+create, no rename).

Firma completa: `setConfigDefinition(name, schema, level = 10000, canOverride = false)`. `level` es quién
puede ver/editar el valor (10000 = admin; un token de bot va ahí); `canOverride` permite que una capa
posterior redefina la misma `name` (por defecto NO: redefinir tira `redefining X is not allowed`, ver #144).

### 🔴 Desde DÓNDE se llama, y por qué no hay que esperar nada

`setConfigDefinition` vive en la **capa db** del plugin `config` (`plugins/config/mongooseDB/config.js`).
Las capas cargan en orden fijo — `db → types → plugins → schemas → APIs` — así que **desde un Schema o
desde el `init` de una punta ya existe: se llama directo**, como hace el modelo de un deploy que lo usa.

El único que necesita esperarlo es quien vive en la **misma capa db** (ej. `unrelatedConfigs.js` o
`definitions.js` del propio plugin): ahí no hay orden garantizado, y por eso usan
`Promise.waitForKey(db, "setConfigDefinition")`. **Ese `waitForKey` NO se copia a un Schema** — es la
marca de un vecino de capa, no del contrato.

Historia (por si aparece en corpus viejo): antes `config` vivía dentro del back y la sobrecarga de `db`
colgaba del Schema `Config` → había que esperar `Config` antes de definir nada. Sacarlo a plugin lo
arregló; la espera es del mundo viejo. Y si el plugin `config` no está instalado, `db.setConfigDefinition`
no existe → revienta en el boot con error claro, que es mejor que un `waitForKey` colgado en silencio.

Desde un `init` de punta (corre al inicio de `process()`, con `db` pelado): primero `await Schema.schemasLoaded`,
después `db.setConfigDefinition(...)` y `await db.getConfig(name)`. Caso real: `plugins/telegram/APP/telegram.js`.

## 2. CREAR el valor — un documento del modelo `Config`

El valor concreto se crea como un **documento** `{name, value, private}` en el modelo `Config`
(colección "Configuraciones"). No es un archivo — se crea por la **UI admin** ("Administración de
Configuraciones"), por **API** (`POST /APP/AAA/Config.json`) o por **MCP**. El `name` debe ser uno
de los definidos en el paso 1 (es un ref restringido); el `value` se valida contra esa definición.
`private` (default `true`) marca configs internas vs. públicas.

## 3. LEER en runtime — sync vs async

El `db` y el `pool` están en el closure de la función Schema (`const {db, pool} = this`). Tres accesos:

| Forma | Sync? | Cuándo |
|---|---|---|
| `db.model("Config").getConfig()` | **Síncrono** (static) | **El recomendado para `default()`/lógica sync.** Cache global en memoria. Vía el `db` del closure — NO requiere pedir Config en `init` (el default corre mucho después de cargar modelos). |
| `pool.Config` | **Síncrono** (dato) | El MISMO objeto cache, acceso directo sin lookup de modelo. Vía el `pool` del closure. |
| `await db.getConfig(name)` | **Async** | Lectura general donde SÍ puedes await (hooks async, bootstrap). Espera `modelReady`. |

Las tres retornan el mapa de configs **por name**:
```js
db.model("Config").getConfig()                 // { OnBoarding: {stages, code}, supportEmail: "...", ... }
db.model("Config").getConfig()?.OnBoarding      // { stages: [...], code: {...} }
```
El cache se refresca solo cuando la config cambia — no hay que recargar a mano.

🔴 **NO uses `this.getConfig()` en un `default`**: Mongoose no garantiza que `this` sea el documento
(en contexto query/`setDefaultsOnInsert`, `this` es la QUERY → revienta). Usa el `db`/`pool` del
closure, que siempre están.

### 🪄 Caveat crítico — sync vs async en `default` depende de si el campo VIAJA

Un `default` async (promesa) es seguro SOLO si el campo **viaja al create**: el delivery del FW
resuelve la promesa a valor en el front. Pero si el campo es **`hidden` en create** (no viaja), el
default corre en el **back** al instanciar el doc → una promesa quedaría **cruda** en el campo (bug).
⟹ para sembrar un campo que NO viaja, el default **DEBE** leer la config en forma **síncrona**
(`db.model("Config").getConfig()` o `pool.Config`), nunca `await db.getConfig()`. Si necesitaras la
config de forma async para sembrar, la siembra va en un `pre("validate")` async, no en el `default`.

## 4. USAR — patrones

**Siembra de un docArray desde la config** (template-as-config): el `default()` del campo lee la
config y genera las filas. Caso real (flujo de incorporación del socio):
```js
onBoarding: {
  type: [OnBoardingStage],
  default() {
    const stages = this.getConfig()?.OnBoarding?.stages ?? [];
    return stages.map(({stage}) => ({stage}));   // snapshot liviano: solo la key
  }
}
```
**Snapshot al crear**: el doc nace con la foto de la config de ese momento → los registros en vuelo
no cambian si la config se edita después. Solo se copia la KEY que liga instancia↔config; el resto
de la definición (responsable, requiresFile, description…) se cruza por esa key cuando se necesita,
no se duplica en la instancia (separación template/instancia).

**Lógica de negocio en la config** (`code`): una config puede llevar un campo `Code` con la lógica
del proceso (guardas, transiciones) que el modelo engancha en sus hooks — así CADA despliegue ajusta
su política sin recompilar. (Diseño; el enganche del code es trabajo del modelo que la consume.)

**Front**: para mostrar/editar el value, el front pide la definición vía `getConfigDefinition(name)`
(BackEnd.js) → endpoint `Config.getDefinition?name=<name>`, que devuelve el form ya tipado.

## Verificación vía MCP

- `callEndpoint GET APP/AAA/Config.getDefinition?name=<name>` → el form del value (confirma el shape).
- `query Config` → los documentos de config creados (name/value reales).
- Crear un registro que dependa de la config y verificar la siembra (ej. `query Member` → su docArray
  sembrado). NO declarar "listo" sin verificar vía MCP.

## 🔴 `schema.set("query", ...)` DINÁMICO (función) — disciplina `preQuery` (2026-07-09)

Cualquier schema puede declarar un filtro automático vía `schema.set("query", ...)` — lo aplica el
plugin GLOBAL `mongoosePlugins/queryFilter.js` (`pre(/^find/)`, corre en EXEC TIME — después de
cualquier `.where()` manual previo, así que gana sobre filtros que colisionan en la misma key). Si el
valor es un **objeto fijo**, es 100% transparente — cero que hacer, cero que recordar.

Si el valor es una **función** (necesario cuando el filtro depende de QUIÉN pregunta — ej. nivel del
usuario, tenant), el mecanismo necesita `req`, y ahí aplica la disciplina:

- **`req` viaja pegado a la Query** vía `.setReq(req)` (ya lo hacen `tableData`/`formData`/`findFilter`
  del pipeline CRUD estándar — un modelo normal no necesita hacer nada extra).
- **NO es una pared de seguridad contra un dev que hace mal su trabajo** — un dev de backend ya tiene
  la BD completa en sus manos, no hay nada que defender ahí. Es un dispositivo de **disciplina/TDD**:
  cachar en PRUEBAS, no en producción, cuando código GENÉRICO (un plugin, una punta reusable que no
  sabe de antemano qué modelos va a tocar) choca contra un modelo que ganó una query dinámica DESPUÉS
  de que ese código genérico fue escrito — el escenario real es "sacamos el release y se cae a los 5
  minutos porque nadie siguió el estándar".
- **Dos estados válidos, sin zona gris**:
  - `query.preQuery(false)` — el dev DECLARA a propósito que esta query puntual es inocua respecto al
    filtro dinámico (ej. un `resave` interno que recorre TODOS los docs, le da lo mismo el filtro).
    Silencio total.
  - **Cualquier otra cosa** (con `req` o sin él — da lo mismo si "por suerte" funcionó) → si la query
    no trae la declaración explícita, **WARNING SIEMPRE** en logs. No importa si esta vez el filtro se
    aplicó bien: el objetivo no es "¿funcionó?", es "¿el dev supo conscientemente que este modelo tiene
    query dinámica?". Sin la declaración explícita, ni el caso feliz se pasa gratis.
- Consecuencia práctica: al agregar una query dinámica a un modelo existente, **auditar** los plugins/
  puntas genéricas que ya lo consultan — el warning en TDD es la señal, no un log que se ignora.
- 🔴 **Finds INTERNOS en hooks (pre/post-save, historial, resave) corren SIN `req`** → si el modelo tiene
  query dinámica que **dereferencia** `req` (`req.isAuth`, `req.getUser()`), el `query(undefined)`
  **CRASHEA** — no "filtra mal", explota con `Cannot read of undefined`. Esos flujos son **inocuos al
  filtro por definición** (lógica de negocio interna, sin externalidad de usuario) → **DEBEN** llevar
  `.preQuery(false)` (o `.preQuery()`, mismo default) en la query, que hace el early-return del `preFind`
  **antes** de ejecutar `query(undefined)`. Caso canónico (2026-07-10): el `__history` de `Accounting.js`
  —`findById(this._id).preQuery()…` en el `pre("save")` que diffea versión actual vs almacenada—. El save
  dispara ese hook sin req, así que **sin `preQuery(false)` el guardar de CUALQUIER modelo con query
  dinámica (ej. `Config`, que hace `req.isAuth`) explota**. Regla mecánica: **todo find dentro de un hook
  que corre sin req → `preQuery(false)`**. Pendiente: barrer el FW por otros finds-en-hook inocuos
  (standby + TDD que cree un modelo con query dinámica y verifique que guardar no revienta).
