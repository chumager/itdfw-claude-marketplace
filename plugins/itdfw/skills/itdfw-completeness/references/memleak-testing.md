# Memleak testing — WeakRef + gc + canario

## Cuándo es OBLIGATORIO

Tocaste algo con **potencial de retención** del documento (o de cualquier objeto que deba morir):
- el **EE del doc** (`doc.on/emit`, pub/sub de un VO);
- **hooks** `pre`/`post` (`validate`/`save`/…) que pueden capturar `this`;
- **globals** (`global.X = this` — el side-effect inocente que mata todo);
- **cache / singletons / `pool`** que guarden refs;
- **closures** registradas en algo long-lived que capturen el doc.

Un browser perdona (se refresca). El **servicio NO**: el leak crece request a request. Si tocaste cualquiera
de esos, el done **exige** esta prueba.

## La herramienta correcta: `WeakRef` (no WeakSet/WeakMap)

- **`WeakRef`**: ref débil a UN objeto. `deref()` → el objeto si vive, `undefined` si ya fue recolectado.
  **Es la única que deja preguntar "¿desapareció?"** sin retenerlo.
- **WeakSet/WeakMap**: claves débiles para colgar metadata sin bloquear GC — pero NO podés sondear "¿sigue
  vivo?" (`.has(obj)` necesita que tengas `obj` = ref fuerte, arruina el experimento). No sirven acá.
- **`FinalizationRegistry`** (complemento): en vez de sondear con `deref()`, te **avisa cuándo** el objeto
  se recolecta (callback). Útil si querés reaccionar a la muerte; para probar, `deref()` es más directo.

🔴 **La asimetría que da la confianza**: `deref() === undefined` (murió) es el lado **robusto** — V8 NUNCA
recolecta un objeto con una ref fuerte viva, así que "murió" no admite falso positivo. El lado frágil es
"sigue vivo": puede ser una ref fuerte accidental (ver el bug de abajo) o que el GC no alcanzó a correr.

## 🔴 El canario — sin esto el test no es de fiar

Un test que **siempre** dice "murió" no prueba nada (podría no estar corriendo el GC). El **canario** es un
objeto gemelo que DEBE **sobrevivir** (retenido a propósito) en la **misma pasada** de `gc()`:
- doc-bajo-prueba muere **Y** canario vive → el test **discrimina** (el GC corrió, el "murió" es real). ✅
- ambos mueren → el harness recolecta indiscriminado, está roto. ❌
- doc-bajo-prueba vive → hay retención real (o ref accidental — revisá el test antes de culpar al código).

## ⚠️ El error clásico (lo cometí y lo pillé)

NO guardes el `deref()` en una variable: `const held = ref.deref()` crea una **ref fuerte** que mantiene el
objeto vivo y **falsea** el siguiente GC. Usá `deref()` **inline** en el check, sin asignarlo.

## Esqueleto canónico

```js
// node --expose-gc <test>.js
const delay = ms => new Promise(r => setTimeout(r, ms));
const collect = async () => { for (let i = 0; i < 5; i++) { global.gc(); await delay(20); } };

const canary = {alive: true};          // DEBE sobrevivir (lo retenemos en este scope)

function makeAndAbandon() {             // el sujeto vive SOLO acá → sale de scope al retornar
  const subject = buildThing();        // crea el doc/objeto con sus listeners/side-effects
  exercise(subject);                   // ejercitá los side-effects (emit, hooks, etc.)
  return new WeakRef(subject);         // WeakRef NO cuenta como ref fuerte
}

const subjectRef = makeAndAbandon();
const canaryRef = new WeakRef(canary);
await collect();

const subjectDead = subjectRef.deref() === undefined;
const canaryAlive = canaryRef.deref() !== undefined; // retenido por `canary` → debe vivir
if (subjectDead && canaryAlive) console.log("✓ sin memleak (y el canario confirma que el GC discrimina)");
else if (!canaryAlive)         console.log("✗ harness roto: el canario murió, no confío en el resultado");
else                           console.log("✗ MEMLEAK: el sujeto sobrevive — algo lo retiene");
```

## Material vivo (ejemplos reales, 2026-06-30)

Tres pruebas que cerraron el diseño pub/sub del FW:
- `doc-gc-weakref.test.js` — listeners cruzados internos → el doc se recolecta (autocontenido).
- `doc-gc-accumulate.test.js` — 1001 listeners sin cleanup → se recolecta igual ⟹ el cleanup es opt, no requisito.
- `doc-gc-external-listener.test.js` — suscriptor externo (`doc.on` desde fuera) → se recolecta ⟹ el EE de
  mongoose NO crea ref inversa; solo ata una **ref directa** en estructura long-lived (caso B, el canario natural).

**Veredicto**: el EE del doc mongoose es GC-safe by design. El único leak posible es una ref directa que vos
guardes (cache/singleton/global) — y eso es justo lo que esta prueba caza.
