// ── TEMPLATE N1 (autocontenido) — VO numérico SIN entorno y SIN dep externa (locale) ──
// Número complejo: aritmética propia (Symbol.toPrimitive) + format propio. No toca el doc ni el locale.
// Es el molde más simple: constructor→parse, getters derivados, aritmética, format, proyección.
export default class Complex {
  constructor(v) {
    Object.assign(this, Complex.parse(v));
  }

  // Dispatcher por firma → forma interna {re, im}. Idempotente. Nullish → vacío (FCC). PLR en inválido.
  static parse(v) {
    if (v instanceof Complex) return v; // idempotente: parse(parse(x)) === parse(x)
    if (v == null || v === "") return {re: null, im: null}; // nullish/FCC
    if (typeof v === "number") return {re: v, im: 0};
    if (typeof v === "object") {
      const {re, im = 0} = v;
      if (typeof re !== "number" || typeof im !== "number") throw new Error("Complex.parse: re/im deben ser number");
      return {re, im};
    }
    if (typeof v === "string") {
      const m = v.replace(/\s/g, "").match(/^(-?\d+(?:\.\d+)?)?([+-]\d+(?:\.\d+)?)i$/);
      if (!m) throw new Error(`Complex.parse: formato inválido "${v}"`);
      return {re: m[1] ? Number(m[1]) : 0, im: Number(m[2])};
    }
    throw new Error("Complex.parse: firma no reconocida");
  }

  get isEmpty() {
    return this.re == null;
  }
  get modulus() {
    return Math.hypot(this.re, this.im); // lógica derivada (getter)
  }

  // aritmética propia — opera y devuelve OTRA instancia (inmutable)
  add(o) {
    o = new Complex(o);
    return new Complex({re: this.re + o.re, im: this.im + o.im});
  }
  multiply(o) {
    o = new Complex(o);
    return new Complex({re: this.re * o.re - this.im * o.im, im: this.re * o.im + this.im * o.re});
  }

  // format SIN locale: el complejo no se localiza (su representación es matemática, universal).
  format() {
    if (this.isEmpty) return "";
    const sign = this.im >= 0 ? "+" : "-";
    return `${this.re}${sign}${Math.abs(this.im)}i`;
  }

  // coerción: number/default → modulus (magnitud, comparable); string → format.
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.format() : this.modulus;
  }

  toJSON() {
    return this.isEmpty ? null : {re: this.re, im: this.im};
  } // transporte
  toBSON() {
    return this.toJSON();
  } // persistencia (empty → null)
}
