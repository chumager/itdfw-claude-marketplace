// ── TEMPLATE N3 (con puntas) — VO con interacción externa: parsers de provider + API EN el type ──
// Suma sobre N2: el VO necesita servicios externos (resolve/autocomplete). Dos piezas:
//  (1) parsers de provider como ESTÁTICOS del VO (raw del provider → options), agnóstico del origen.
//  (2) las puntas (endpoints) van en `options.API` del TYPE → ATOMICIDAD: al mirar el type ves cast +
//      options + sus APIs juntos (como Password). NO en un bloque API separado del FWP (como Address hoy,
//      que pierde atomicidad: mirando el type no sabés que tiene puntas).

export class Place {
  constructor(v) {
    Object.assign(this, Place.parse(v));
  }
  static parse(v) {
    if (v instanceof Place) return v; // idempotente
    if (v == null || v === "") return {coordinates: null, label: null}; // nullish/FCC
    const c = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(c.coordinates) || c.coordinates.length !== 2)
      throw new Error("Place.parse: coordinates debe ser [lng, lat]");
    return {coordinates: c.coordinates, label: c.label ?? ""};
  }
  get isEmpty() {
    return this.coordinates == null;
  }
  get lng() {
    return this.coordinates[0];
  }
  toJSON() {
    return this.isEmpty ? null : {coordinates: this.coordinates, label: this.label};
  }
  toBSON() {
    return this.isEmpty ? null : {type: "Point", coordinates: this.coordinates, label: this.label};
  }

  // dispatcher de parsers de provider: raw → options [{text, value}]. El VO NO hace fetch (agnóstico del origen).
  static toOptions(raw, api) {
    const parser = Place[`parse${api[0].toUpperCase()}${api.slice(1)}`];
    if (!parser) throw new Error(`Place.toOptions: falta parser para "${api}" (define Place.parse${api})`);
    return parser(raw);
  }
  // ejemplo de parser de un provider "foo" (cualquier externo sobrecarga: Place.parseBar = raw => [...]).
  static parseFoo(raw) {
    return (raw.items ?? []).map(i => ({
      text: i.name,
      value: JSON.stringify({coordinates: i.coords, label: i.name})
    }));
  }
}

// type-spec DELGADO con el API EN el type (atomicidad). El FW lo envuelve en extends SchemaType.
// #2: N3 NO captura entorno → declarás `class: Place` (sin cast manual); el caster de #loadTypesFromObject
// arma el wrapper estándar (RegExp passthrough / null→null / instanceof→idempotente / new Place(v)).
export const placeType = {
  Place: {
    class: Place,
    options: {
      // 🔴 las puntas del type viven ACÁ (no en un bloque API aparte del FWP) → type autocontenido.
      API: {
        // GET /APP/placeAutocomplete.json?filter=... → delega al provider y normaliza con Place.toOptions
        placeAutocomplete: {
          isAnonymous: true,
          defaultMethods: ["GET"],
          async GET(req, res) {
            // const raw = await fetchProvider(req.query.filter);  // (el fetch real, omitido en el template)
            // res.json(Place.toOptions(raw, "foo"));
            res.json([]);
          }
        }
      }
    }
  }
};
