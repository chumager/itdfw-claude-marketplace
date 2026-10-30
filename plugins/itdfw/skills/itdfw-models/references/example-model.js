// Ejemplo BASE: un modelo de negocio plano, completo y mínimo.
// DÓNDE: <documentRoot>/DEFAULT/mongooseSchema/Vehicle.js (todas las apps)
//        o <documentRoot>/<app>/mongooseSchema/Vehicle.js (solo esa app).
//        documentRoot viene de la config del deploy (/etc/itdfw/<deploy>.yaml) — verificarlo ahí.
function Schema() {
  const {db} = this; // this = instancia Schema del FW
  this.init("Vehicle"); // registra el modelo; sin deps → sin await, función síncrona

  const Vehicle = new db.Schema(
    {
      // ===== CAMPOS: type es lo único obligatorio; name (label) en la práctica siempre =====
      plate: {
        type: String,
        name: "Plate",
        required: "Debe indicar la patente", // string = mensaje de error visible
        unique: true, // el FW genera el índice (multitenant + partial soft-delete)
        immutable: true, // identidad: se escribe una vez
        filter: true, // filtrable en grilla (índice automático)
        pos: 1, // orden en el form
        tablePos: 0 // orden en la grilla
      },
      brand: {type: String, name: "Brand", required: true, filter: true},
      year: {type: Number, name: "Year", min: 1990, max: 2100},
      // enum: values SIEMPRE inglés camelCase; el front rinde Select solo (derivado)
      fuelType: {
        type: String,
        name: "Fuel Type",
        enum: ["gasoline", "diesel", "electric", "hybrid"],
        default: "gasoline",
        filter: true
      },
      // types del catálogo del FW: cast + validación + component GRATIS (MCP listTypes los muestra)
      contactEmail: {type: "Email", name: "Contact Email"},
      // referencia a otro modelo: el front rinde Select con options dinámicas, todo derivado
      owner: {type: "ObjectId", ref: "User", name: "Owner", filter: true}
    },
    {
      // ===== OPTIONS del modelo =====
      name: "Vehicle Administration", // título del administrador del modelo
      modelName: "Vehicles", // plural / colección
      description: "Fleet vehicles of the deployment.",
      icon: "truck",
      defaultMethods: ["GET", "POST", "PUT", "DELETE"] // qué CRUD existe
    }
  );

  // ===== RETORNO: objeto {NombreRegistrado: schema}. Puede traer varios. =====
  return {Vehicle};
}

export default Schema;

// PRUEBAS (MCP itdfw, sin leer código):
//   listModels                 → Vehicle aparece
//   modelFields Vehicle        → paths/types/labels correctos
//   schemaToForm Vehicle       → el form que verá el usuario
//   schemaToTable Vehicle      → columnas de la grilla
//   query Vehicle              → el CRUD opera
