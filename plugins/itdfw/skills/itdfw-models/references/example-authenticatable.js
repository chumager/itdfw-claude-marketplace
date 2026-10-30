// Ejemplo MÍNIMO de modelo AUTENTICABLE en ITDFW.
//
// 🔴 EL PATRÓN ES UNO Y NO PUEDE SER OTRO: clon de User vía safeClone. Eso ES el modelo
// autenticable — hereda completa la capa AAA (login, sesión, JWT, recovery, paths con
// auth:"password", checkLogin, userData). Implementar auth por fuera = perder TODA esa capa.
//
// La BASE FUNDAMENTAL son las ~10 líneas de abajo. Todo lo demás es OPCIONAL según necesidad.
async function Schema() {
  const {db} = this;
  const {
    Schemas: {User}
  } = await this.init("Customer", {schemas: ["User"]});

  // ===== BASE (obligatoria): el clon. Opciones FLAT — NO {options: {...}} =====
  const Customer = User.safeClone({
    name: "Customer Administration",
    modelName: "Customers",
    description: "External customers (clone of User — authenticable).",
    defaultMethods: ["GET", "POST", "PUT", "DELETE"],
    // Decisión FUNDAMENTAL de todo autenticable: ¿tiene registro externo público?
    //   true  → la punta anónima /APP/register (ya existe en el FW) acepta este modelo.
    //   omitir/false → solo creación interna (admin). User NO la lleva (usuarios internos).
    registrable: true
  });

  // Con SOLO lo de arriba el modelo ya autentica (front setea modelAuth:"Customer") y,
  // por registrable, ya se puede registrar desde afuera con el form filtrado por contexto.

  // ===== OPCIONAL 1: perfil FORZADO (tipo de usuario estricto — cliente externo B2B2C) =====
  // Si las instancias tienen UN perfil fijo por naturaleza, forzarlo + cerrar la escalada:
  // `profiles = []` SIEMPRE (create Y update) o un PUT puede inyectar perfiles extra.
  Customer.pre("validate", async function () {
    this.profiles = [];
    if (this.isNew && !this.profile) {
      const profile = await db.model("Profile").findOne({profileName: "Customer"}); // camelCase
      if (!profile) throw new Error("No existe el perfil 'Customer'.");
      this.profile = profile;
    }
  });
  // Y los paths de permisos forzados se ocultan GLOBAL (ni el admin los gestiona acá):
  ["profile", "profiles", "level"].forEach(p => {
    Customer.path(p).options.hidden = true;
  });

  // ===== OPCIONAL 2: ajustes a fields HEREDADOS (solo si se necesita) =====
  // Ej.: restricciones de contexto sobre el perfil propio (el admin SÍ los gestiona):
  Customer.path("username").options.hidden = ["profile"];
  Customer.path("firstname").options.readonly = ["profile"];

  // ===== OPCIONAL 3: campos EXTRA del negocio (solo si se necesitan) =====
  // Reglas: types del catálogo (no String para lo que tiene type), enums inglés camelCase,
  // identidad con immutable+unique, campos localizables genéricos (String → plugin de tenant).
  Customer.add({
    phone: {type: "Phone", name: "Phone", required: true}
  });

  return {Customer};
}

export default Schema;
