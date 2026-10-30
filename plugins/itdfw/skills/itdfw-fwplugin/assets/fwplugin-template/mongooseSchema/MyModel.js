/*
 * MyModel — schema de negocio. Función Schema; `async` solo si depende de otro schema/modelo (this.init con
 * {schemas|models}). Campos {type, name}: type nativo o del catálogo (MCP listTypes). Skill itdfw-models.
 * Para un modelo de PRUEBA (e2e) → `isAnonymous:true` + gate onDev (skill itdfw-completeness).
 */
function MyModel() {
  const {db} = this;
  this.init("MyModel");
  const MyModel = new db.Schema(
    {
      name: {type: String, name: "Name"}
    },
    {name: "My Model", modelName: "MyModels", defaultMethods: ["GET", "POST", "PUT", "DELETE"]}
  );
  return {MyModel};
}
export default MyModel;
