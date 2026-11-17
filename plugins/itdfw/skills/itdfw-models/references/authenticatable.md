# Modelos autenticables (sus instancias se loguean)

🔴 **EL PATRÓN ES UNO Y NO PUEDE SER OTRO: clon de User vía `safeClone`.** `safeClone` es el
mecanismo GENERAL de clonación de schemas (hereda estructura + lógica de negocio de CUALQUIER
modelo — ver SKILL.md §4b); su corolario aplicado a User es ESTE patrón: el clon hereda completa
la capa AAA del FW — login, sesión, JWT, recovery, paths con `auth:"password"` (username/email),
checkLogin, userData. Implementar auth por fuera = perder TODA esa capa. Ver
[example-authenticatable.js](example-authenticatable.js).

```js
const Member = User.safeClone({   // opciones FLAT — NO {options: {...}}
  name: "Member Administration",
  modelName: "Members",
  description: "...",
  defaultMethods: ["GET", "POST", "PUT", "DELETE"],
  caducate: false,                 // típico en externos: no expiran
  registrable: true                // ver abajo — decisión FUNDAMENTAL
});
```
(Requiere `async function Schema` + `const {Schemas: {User}} = await this.init("X", {schemas: ["User"]})`.)

## `registrable` — decisión constitutiva de todo autenticable

¿Este usuario nace desde AFUERA (registro público) o solo lo crea un admin?
- `registrable: true` → la punta anónima `/APP/register` (YA existe en el FW, no se implementa nada)
  acepta el modelo: `GET ?model=X` entrega el form filtrado por contexto register; `POST` crea con
  el body filtrado (lo que el form no muestra, el receptor no acepta).
- omitir/false → solo creación interna. (User mismo NO es registrable: usuarios internos.)

Front del registro: skill `itdfw-api-system`, sección "Registro público de un modelo".

## Checklist OBLIGATORIO del clon (fallas reales de un baseline sin este skill)

1. **Perfil FORZADO + anti-escalada** (clientes externos con perfil único por naturaleza):
```js
Member.pre("validate", async function () {
  this.profiles = [];              // SIEMPRE (create Y update) — un PUT no puede inyectar perfiles
  if (this.isNew && !this.profile) {
    const profile = await db.model("Profile").findOne({profileName: "Member"}); // camelCase!
    if (!profile) throw new Error("No existe el perfil 'Member'.");
    this.profile = profile;
  }
});
```
   Sin el `profiles = []` hay **escalada de permisos** (inyección de perfiles por PUT).
   🔴 **El perfil base se llama igual que el modelo** (`Member` → perfil `Member`): es el estándar de facto, y es
   el único perfil que un plugin o un TDD nombra. Un tipo de usuario distinto (el dueño de una feria) es otro clon,
   con su perfil base del mismo nombre, y eso está bien.
   🔴 **El plugin define CAPACIDADES, no a quién pertenecen.** Cada capacidad (cobrar, revertir una venta) es una
   función asignable. A lo más, el TDD sugiere en qué perfil iría por defecto. Quién la recibe es configuración, y
   baja por la cadena de tenants: el owner arma los perfiles de sus usuarios, esos arman los de los suyos, cada uno
   dentro de lo que su level le deja repartir. Así, un `standOwner` que hace todo y un `standSale` que solo vende
   salen de configuración y no de código. Un "solo el dueño revierte" escrito en un contrato o en una punta es
   programar una asignación: es hallazgo, y delata que no se conoce el flujo del FW.
2. **Identidad INMUTABLE**: `nationalId: {immutable: true, unique: true}` — se declara una vez,
   nadie la cambia (ni el admin). Identidad mutable = vector de estafa/suplantación.
3. **hidden GLOBAL vs CONTEXTO** — no son lo mismo:
   - GLOBAL (`hidden: true`) SOLO para paths forzados que ni el admin gestiona: `profile`,
     `profiles`, `level`.
   - Lo que el ADMIN sí gestiona (`verbosity`, `blocked`+`reason`, `components`)
     NO se oculta global — se restringe por CONTEXTO si aplica (`hidden: ["register","profile"]`).
   - 🔴 Solo se ocultan paths que EXISTEN en User: `Member.path(p)` de un path que ya no está devuelve
     `undefined` y `.options` tumba el arranque. `canTranslate` salió de User en back 7.5 (el permiso de
     traducir es la función de perfil `Translation/redefine`): un clon que lo tenga en su lista lo saca.
   - Regla: campo oculto en `profile` por "autoridad sobre sí mismo" ⟹ también oculto en
     `register` (contexto más restrictivo aún: es anónimo).
4. **Password required** en clones registrables (User interno no lo exige; el clon externo sí):
   `Model.path("password").required("Debe existir la contraseña");`

## Activación en el front (trivial, ~5 min)

El back provee el flujo completo; el front solo setea el store de auth:
`commit("auth/setAuthMode", {modelAuth: "Member", modelOption: "email"})` (modelOption fijo salta el
selector de método). Ruta-portal opcional con `meta: {redirect: true}` → tras login va al `link` del
perfil. Detalle: skill `itdfw-api-system`, "Autenticación de un modelo nuevo".

## Verificación específica

- `modelFields <Modelo>` — heredó username/email/password + tus campos.
- `callEndpoint GET APP/register.json?model=X` (si registrable) — form filtrado SIN campos de
  autoridad (blocked/reason/level/profiles/verbosity).
- Login real: crear instancia y autenticar con modelAuth.
