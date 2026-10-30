// ── TEMPLATE N2 (con entorno) — VO cuyo valor DEPENDE de un valor del root del doc (la "currency") ──
// Suma sobre N1: el VO no se basta solo; necesita un dato que vive UNA vez en el root (no por hijo) y debe
// REACCIONAR cuando ese dato cambia. Solución: pub/sub al EE del doc + `prev` para limpiar el listener viejo.
//
// El VO sigue PURO (solo expone setCurrency/format). El CABLEADO al entorno vive en el `cast` del type
// (capa adapter) — abajo va `castMoney` como MOLDE del cast (el FW lo envuelve en extends SchemaType).
//
// Acá el "doc" se mockea con un EventEmitter para que el template sea ejecutable sin mongoose. En el FW real,
// el doc YA es EE-like (on/emit/removeListener; NO `off`) y `doc.ownerDocument()` sube al root.

export class Money {
  constructor(amount, currency) {
    this.amount = amount == null || amount === "" ? null : Number(amount);
    if (this.amount != null && Number.isNaN(this.amount)) throw new Error(`Money: amount inválido`);
    this.currency = currency ?? null;
  }
  get isEmpty() {
    return this.amount == null;
  }
  // precisión intrínseca de la moneda (sin locale)
  get fractionDigits() {
    if (!this.currency) throw new Error("Money.fractionDigits: falta currency");
    return new Intl.NumberFormat("en", {style: "currency", currency: this.currency}).resolvedOptions()
      .maximumFractionDigits;
  }
  // gancho del pub/sub: cambia la moneda (NO convierte el valor)
  setCurrency(currency) {
    this.currency = currency;
    return this;
  }
  format(locale) {
    if (!locale) throw new Error("Money.format: falta locale (runtime)");
    return new Intl.NumberFormat(locale, {style: "currency", currency: this.currency}).format(this.amount);
  }
  toBSON() {
    return this.isEmpty ? null : Number(this.amount.toFixed(this.fractionDigits));
  }
  // la moneda NO viaja: es del root (_currency). El transporte es el monto, igual que la persistencia.
  toJSON() {
    return this.toBSON();
  }
}

// MOLDE del cast del type (el FW lo envuelve). Firma real del FW: cast(val, doc, init, prev, options).
// Captura el entorno (root._currency), cablea el listener al EE del root, y limpia el del VO anterior (prev).
export function castMoney(val, doc, _init, prev) {
  if (val instanceof RegExp) return val; // ⚠️ zona-gris: filtros (castForQuery → applySetters → cast) — mismo guard que el wrapper de `class`. La omitió un cajarito en la eval; va siempre.
  if (val == null) return null; // FCC
  const root = doc.ownerDocument(); // sube al root (cubre nested a cualquier profundidad)
  if (prev?.listener) root.removeListener("newCurrency", prev.listener); // mata el listener del VO viejo → sin leak
  const vo = val instanceof Money ? val : new Money(val, root._currency);
  vo.listener = c => vo.setCurrency(c); // el listener vive en el VO
  root.on("newCurrency", vo.listener); // el setter de _currency del root hace root.emit("newCurrency", v)
  return vo;
}
