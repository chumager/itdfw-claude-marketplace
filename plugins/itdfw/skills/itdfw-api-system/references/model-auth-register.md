# Autenticación y registro de un modelo nuevo — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

## Autenticación de un modelo nuevo (autenticable = clon de User)

**🔴 Premisa: NO se implementa NADA de auth para un modelo nuevo.** Si un modelo es **autenticable**
(sus instancias se loguean) se declara como **clon de User** (`User.safeClone(...)`). Con eso hereda
TODO el aparato de auth del back, gratis y sin una línea nueva:
- `authForm.json` — genera el form de login según `{model, option}`.
- `checkLogin.json` — valida credenciales, puebla sesión, devuelve `userData` + `link` (página del perfil).
- `recovery.json` — recuperación de contraseña.
- Los paths con `auth: "password"` (username/email/identidad) ya son las opciones de login.
- Perfil forzado (en `pre("validate")` el modelo asigna su perfil único — buscar por **`profileName`**
  camelCase, verificado vía MCP `modelFields Profile`, NUNCA copiar `profile_name` snake de un corpus viejo).

### La frontera back↔front (zona gris)
El **back provee el flujo completo**; el **front solo lo activa con valores de store** (módulo `auth`):

| Valor (store `auth`) | Qué hace | Cómo se setea |
|----------------------|----------|---------------|
| `modelAuth` | Modelo a autenticar (default `"User"`) | `commit("auth/setAuthMode", {modelAuth: "Member"})` |
| `modelOption` | Método de login fijo → salta el select de "forma de autenticar" | mismo `setAuthMode`, `{modelOption: "email"}` |

**La pega del front es trivial (~5 min) y opcional**: basta setear esos valores de store **en cualquier
parte** (el botón Auth del nav ya dispara el flujo — no es obligatorio crear una vista ni una ruta
dedicada). Si se quiere una ruta/portal propio (ej. `/Member`), la ruta lleva **`meta: {redirect: true}`**
→ tras autenticar, el FW manda al socio al `link` (página principal) de su perfil. Las rutas "puerta"
(login/register/recovery/home) llevan ese meta; es polimórfico (cada perfil define su `link`).

`forceLink` (state del store) es OTRO caso (DelegatedUser fuerza redirect al cambiar a modo delegado);
su branch en el store está comentado (deuda). Para login normal el mecanismo es `meta.redirect`.

> Detalle de cómo construir el MODELO autenticable (clon, perfil forzado, multitenant): ver
> Doc «principios-modelos» §1.

## Registro público de un modelo (registrable = clon de User + flag)

**🔴 Premisa hermana de la anterior: NO se implementan puntas de registro para un modelo nuevo.** Las
puntas globales YA existen (`User.options.API` key `register`, anónimas, nivel 2):
- `GET /APP/register.json?model=X` → `{form, specs}` (form filtrado por contexto register).
- `POST /APP/register.json?model=X` → `FWregister` → `setData("register")` → `pickRegister` filtra el body.

Para hacer registrable un modelo (que DEBE ser clon de User):
1. **`registrable: true`** en sus schema options — gate ESTRUCTURAL de la punta (no AAA; el QS no puede
   volver registrable a un modelo que no lo es). User NO la lleva (internos, sin registro público).
2. Campos propios que el registrante no debe tocar → `hidden:["register"]` (los de User ya vienen
   blindados de la raíz).
3. Front: ruta `{path:"/Register", component:"Register", props:{authModel:"X"}}` — **SIN `meta.model`**
   (activaría el shell → pide help AAA-gated → 401 en anónimo → login indebido). La vista resuelve
   `props.authModel ?? store.auth.modelAuth` (frontoffice usa el store; landing pasa el prop). La vista
   `Register` (core/views) es sobrecargable por cascade; monta `ItdRegister` (core/components) que consume
   `getRegisterForm()`/`setRegister({data})` de BackEnd.js (model del closure, sin argumento).

**CSRF normal** (el front manda token como checkLogin) — `skipCSRF` NUNCA para forms de browser.
**Anti-vestigio**: register como CRUD del modelo (child Register en setRoute, espejos formRegister,
`case "register"`) fue eliminado 2026-06-09 — si aparece en un corpus viejo (código legacy), NO imitarlo.
Capas pendientes del flujo: verificación de correo (doble opt-in, patrón recovery) + captcha (Config).

> Enseñanza completa: doc «principios-modelos» §6. Ruta real: la bitácora del register (2026-06-09).
