/* global onDev */
// The type at the 4 nesting levels. The file decides its own existence: index.js plugs it in unconditionally.
function Schema() {
  if (!onDev) return {}; // first line: no init, no schema, no warning in production
  const {db} = this;
  this.init("MyTypeTest");
  const Line = new db.Schema({value: {type: "MyType", name: "Value"}}, {_id: false});
  const MyTypeTest = new db.Schema(
    {
      value: {type: "MyType", name: "Value"},
      values: {type: ["MyType"], name: "Values"},
      embedded: {type: Line, name: "Embedded"},
      lines: {type: [Line], name: "Lines"}
    },
    {name: "MyType Test", modelName: "MyTypeTests", isAnonymous: true}
  );
  return {MyTypeTest};
}
export default Schema;
