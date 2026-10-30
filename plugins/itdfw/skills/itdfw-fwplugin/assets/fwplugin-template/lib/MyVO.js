/*
 * MyVO — Value Object ISOMORPHIC (JS puro; NO importa mongoose ni el front). La MISMA clase la usan el
 * type del back (cast/toBSON) y el componente del front. Vive en lib/ porque es lo compartido.
 * Contrato completo (construcción TOTAL, setValue, setters ambientales, static cast, validate de
 * ESENCIA, checkRequired) → skill `itdfw-ddd-value-objects`.
 */
export default class MyVO {
  #value;

  // NUNCA lanza (construcción TOTAL: nulish = standby). Sin `static cast`, el motor hace
  // `new VO(...args)` con la firma del caster de mongoose — NO declares cuántos son ni qué significan:
  // mongoose los cambia. Toma por posición SOLO los que ocupes; el resto viaja igual.
  constructor(value /*, ...args del caster */) {
    this.setValue(value);
  }

  // TRÁNSITO: normaliza y asigna. NO valida ni lanza — el estado intermedio es legítimo.
  setValue(value) {
    this.#value = value ?? null;
    return this;
  }

  get value() {
    return this.#value;
  }
  // "NADA de nada" — el motor lo usa para el required de todo type con clase
  get isEmpty() {
    return this.#value == null;
  }

  // LA punta que lanza: valida la ESENCIA (lo que hace que el valor SEA). Vacío pasa (FCC).
  validate() {
    if (this.isEmpty) return true;
    return true;
  }

  toJSON() {
    return this.isEmpty ? null : this.#value;
  } // transporte al front
  toBSON() {
    return this.isEmpty ? null : this.#value;
  } // persistencia
}
