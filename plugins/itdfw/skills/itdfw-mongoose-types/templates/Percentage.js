// ── TEMPLATE N1 (con dep externa) — VO numérico cuyo .format CUELGA DEL LOCALE ──
// Complementa Complex: misma base (autocontenido del entorno-doc, sin tocar el doc) PERO su format
// depende del locale (Intl `style:"percent"` varía por localización: "75 %" es-CL vs "75%" en-US).
// 🔴 La dep externa (locale) es RUNTIME → solo la pide `format` (PLR si falta). El VALOR no la necesita.
// `value` = fracción (0.75 ⇒ 75%); Intl percent multiplica ×100 al mostrar.
export default class Percentage {
  constructor(v) {
    Object.assign(this, Percentage.parse(v));
  }

  static parse(v) {
    if (v instanceof Percentage) return v; // idempotente
    if (v == null || v === "") return {value: null}; // nullish/FCC
    const value = Number(v);
    if (Number.isNaN(value)) throw new Error(`Percentage.parse: valor inválido "${v}"`);
    return {value};
  }

  get isEmpty() {
    return this.value == null;
  }

  // format: la ÚNICA función que pide la dep externa (locale) → PLR si falta (sin default silencioso).
  format(locale, {precision = 2} = {}) {
    if (!locale) throw new Error("Percentage.format: falta `locale` (runtime, sin default)");
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(this.value);
  }

  // proyección XLS: vive EN el VO (atomicidad — no en un plugin toXLS aparte). z = formato de celda %.
  toXLS() {
    return {t: "n", v: this.value, z: "0.00%"};
  }

  [Symbol.toPrimitive]() {
    return this.value;
  } // aritmética sobre la fracción
  toJSON() {
    return this.isEmpty ? null : this.value;
  }
  toBSON() {
    return this.isEmpty ? null : this.value;
  }
}
