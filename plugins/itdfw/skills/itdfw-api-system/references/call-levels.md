# Niveles de llamada, seguridad por verbo, extensión y coherencia estructural

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle y los casos.

## Los 3 niveles de llamada de una punta — composición vs estructura

Las tres ramas de resolución del executor (arriba) NO son "granularidad creciente" — son una decisión de diseño sobre **DÓNDE vive la discriminación** del request. El dispatcher las resuelve igual; lo que cambia es quién decide qué corre.

| Nivel | Forma | Discriminación vive en | Eje HTTP |
|-------|-------|------------------------|----------|
| **1** | `API[func]` = función | **TU código** (factory interno) | recurso |
| **2** | `API[func][method]` = `GET(req,res)` | el **dispatcher FW** (por verbo) | recurso + método |
| **3** | `API[func][method][ext]` = `GET:{form,data}` | el **dispatcher FW** (verbo + ext) | recurso + método + representación/MIME |

**Niveles 2-3 = modo ESTRUCTURA.** La discriminación es **declarativa**: el FW resuelve por verbo/ext. Handlers fijos al boot, explícitos en la declaración. El dev afín a estructura prefiere esto: se ve qué puntas hay sin leer el cuerpo.

**Nivel 1 = modo COMPOSICIÓN.** La discriminación vive en **tu código**: `GET(req) → factory(req)` y el factory decide internamente (por ext, por QS, o **por info de la BD**). El dev afín a composition prefiere esto.

🔑 **El superpoder del nivel 1 que el 2-3 NO pueden: dinamismo.** Un factory que lee la BD define **funciones dinámicas en runtime** — endpoints cuyo comportamiento depende de datos. Con `GET:{funcA,funcB,funcC}` los handlers están hardcodeados en el objeto al boot; no puedes inventar `funcD` porque apareció un registro en Mongo. Con el factory, sí. Es **database-native llevado a la capa de routing** (coherente con schemas-como-datos del FW).

**Ejemplo**: el `json` con `switch(req.query.type)` de `FrontEnd.js` (form/specs/value por QS) ES composición pura. Funciona, pero ahí se eligió migrar a extensiones separadas (`tableForm`, `formSpecs`, `formCreate`… = estructura) porque salía más barato/legible. Prueba viva de que **ambos caminos son válidos** — es diseño, no jerarquía donde uno gana.

### 🔴🔒 El costo de seguridad del nivel 1: el AAA discrimina por VERBO

El AAA gatea permisos **por verbo** — `GET`/`POST`/`PUT`/`DELETE` son capacidades separadas en el profile. Esto cambia radicalmente entre niveles:

- **Niveles 2-3 (estructura) → AAA por verbo GRATIS y a prueba de balas.** El dispatcher resuelve `API[func][method]`: al handler `DELETE` SOLO se llega si pasaste el gate `DELETE`. El verbo del request ya fue validado contra el permiso de ESE verbo antes de tocar tu código. Imposible ejecutar lógica de mutación con permiso de solo-lectura.
- **Nivel 1 (composición) → el candado por verbo se ROMPE.** Hay un solo handler para todos los verbos → el AAA solo gatea a nivel `func`, no por método. Si tu profile da permiso `GET` y tu factory ejecuta lógica de mutación según body/QS **sin re-discriminar el verbo internamente**, un atacante con permiso `GET` dispara lógica `POST`/`PUT`/`DELETE` → **escalada de privilegio**. La discriminación de seguridad por verbo, que en estructura hace el FW, en composición **es responsabilidad del dev** — fallarla es un hoyo.

> **Regla**: si eliges nivel 1 (composición), tu factory DEBE re-discriminar el verbo (`req.method`/`req.requestedMethod`) antes de ejecutar cualquier lógica con efecto de mutación, replicando el gate que el FW te daría gratis en nivel 2-3. La cara B del dinamismo: ganas factory dinámico que lee BD, pero asumes el AAA por verbo a mano. Si la lógica del endpoint cruza verbos con efectos distintos, **prefiere nivel 2-3** y deja que el FW cuide el gate.

### 🔴 La extensión es SIEMPRE obligatoria en la llamada

Toda punta se llama **con extensión en la URL**, en los 3 niveles, sin excepción. Lo que varía es si el back la USA:
- **Nivel 3**: la ext **discrimina** el handler (`.form` ≠ `.data`) → tiene significado.
- **Nivel 1-2**: la ext es **decorativa/MIME** → cae al handler del verbo (o al factory) sin importar cuál pongas. "Coherencia de chiche", no funcional.

**Doble razón de la obligatoriedad**:
1. **Sintáctica**: la regex del router (`/APP/:func.:ext`) la exige. Es decisión de diseño (se podría relajar a ruta sin ext), pero no aporta.
2. **Semántica**: coherencia REST — todo request declara la representación que espera (es el `Accept`/content-type, pero en la URL). Aunque en nivel 1-2 no discrimine, **declara intención de formato** → el request tiene sentido completo por sí solo. Esa coherencia es la que habilita el nivel 3 sin casos especiales: la ext ya está siempre, solo cambia si el back la lee o la ignora.

> **🔴 Anti-patrón** (error típico): proponer una punta como `/APP/register/form` (path con slash, sin ext) o querer `skipCSRF` "porque es anónima". (a) La estructura correcta es `/APP/register.form` — `form` es el handler-ext (nivel 3) o `GET(req,res)` con ext decorativa (nivel 2). (b) CSRF aplica a TODO POST de browser, anónimo incluido (protege contra forgery cross-site; el front anónimo pide `getCSRF` y manda el token igual que `checkLogin`). `skipCSRF` es solo para machine-to-machine/webhooks que no pueden obtener token — nunca para un form de browser.

## Coherencia ESTRUCTURAL: declaración = existencia

Las operaciones CRUD que el modelo NIEGA (`noCreate`/`noUpdate`/`noCRUD`, o Upload sin `transform`)
**NO EXISTEN** a nivel HTTP — no son un 401/403 de permisos. 🔴 Pero OJO a qué capa lo produce (no
confundir presentación con definición):
- **`setRoute` = PRESENTACIÓN, no declaración.** No construye el child (Create/Update/Upload) → el router
  del front no lo tiene → si por bug se filtra el botón y lo pinchas, caes en un **404 del FRONT = un
  COMPONENTE 404**, NO un HTTP 404. Cero tráfico al back. **No razones el status HTTP desde acá.**
- **`checkAndLoadEndpoint` = DEFINICIÓN: es el que CAPEA las puntas.** noXXX → la punta de delivery
  (espejos GET formCreate/formUpdate/formData, POST formCreate/upload, exts funcionales) **no se registra**
  → headless → `execEndpoint` UNKNOWN FUNCTION → **HTTP 404 real**. Esta es la "coherencia de capado":
  el 404 lo da el EXECUTOR sobre una punta capada por capacidad, **nunca una punta viva diciendo "no existo"**.
- **Los CHECKERS viven SIEMPRE** (`checkCreate/checkUpdate/checkDelete/checkUpload`): son el aviso al
  front de qué parte del CRUD tiene el modelo.

**La tríada semántica de status (NO confundir los planos):**
| Status | Significa | Lo decide |
|---|---|---|
| **401** | la punta EXISTE pero no estás autenticado | AAA (hasAccess) |
| **403** | estás autenticado pero NO tienes permiso | AAA/perfiles |
| **404** | la punta no está registrada — capada por capacidad (noXXX en `checkAndLoadEndpoint`) o nunca declarada | el **EXECUTOR** (UNKNOWN FUNCTION) |

> 🔴 Una punta VIVA (que se ejecuta) **nunca** responde 404 sobre sí misma — sería incoherente. El 404 de
> "no existe la punta" lo da SIEMPRE el executor sobre algo no registrado. Caso aparte: una punta viva
> puede responder 404 de **RECURSO** (`documento por id no encontrado`) — eso SÍ es coherente (el recurso
> pedido no existe, no la punta).

`execEndpoint` responde **404** ante ext inexistente (UNKNOWN FUNCTION).
Los statics internos (`FWcreate`/`FWupdate`/`FWdelete`) sobreviven siempre — los usan callers
internos (saveRefs).

> 🔴 Gotcha: los handlers de endpoint declarados en plugins NUNCA deben
> clausurar sobre `schema` — operar SIEMPRE vía `this` (el Model bindeado post-model). Un set de handlers compartido
> a nivel de módulo (objeto `verbs`) sería común a TODOS los schemas; solo la disciplina del `this` evita que un handler
> opere sobre el schema equivocado.
