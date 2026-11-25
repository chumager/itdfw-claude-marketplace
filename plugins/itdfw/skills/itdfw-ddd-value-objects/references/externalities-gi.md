# El VO frente al GI — regreso, pure-externality, wrapper y componente pelado

> El contrato corto vive en `SKILL.md`. El detalle del lado del front está en `itdfw-front-develop` →
> `vo-gi-contract.md`.

## El REGRESO (`initVal` + `onChange`)

`initVal` es externo → display, declarativa; el fallback nativo del GI es SOLO para componentes sin VO. `onChange(cb)`
es el regreso: el VO cambió su valor por una externalidad → notifica con el valor YA initVal'eado → el GI lo asigna al
VSV → la cascada natural corre sola. Canales paralelos (símbolos, textos de medidas) son slots aparte del VO,
registrados por el componente. El módulo de conformance debe chequear ambas puntas.

## VO PURE-EXTERNALITY

Si el VO en modo external NO tiene valor propio (su valor es 100 % DERIVADO de las externalidades, como un VO de
crédito), no emite `onChange` por externalidades: la misma externalidad que gotea re-evalúa el computed EV y el
`initVal` retorna la derivación fresca (un ciclo, cero eventos). Emitir dentro del goteo es escritura-dentro-de-lectura:
el goteo corre DENTRO del EV, la notificación reentra a mitad de evaluación y la cola del computed la pisa.

- `initVal` = derivación pura: retorna SIEMPRE la derivación. El PRIMER descenso no-vacío se guarda (`#initial ??=`)
  para el caso update y la validación futura contra datos legacy.
- `onChange` queda reservado a cambios INTERNOS que el pipeline no ve (cadena cuota→crédito en modo libre).
- Construcción PURA en el componente: sin precarga de arrays.
- Las dos patas (una externalidad que cambia EV≠VSR, declarada y sin caso todavía, y una que cambia formateo+initVal)
  quedan cubiertas por el early-return del valor final.

## El wrapper de externalidades

```js
// created() del componente — el ADAPTER: solo el componente sabe que hay cochinada
const vm = this;
this.VO = class extends Currency {
  constructor(...args) { super(...args); this.setLocale(vm.staticLocale); }
};
```

Clase pura (el back jamás ve el wrapper), el GI ni se entera, la externalidad queda en la frontera. Regla de oro: el
wrapper lee fuentes PLANAS (`vm.staticLocale`, un snapshot que actualiza un watcher), NUNCA el getter reactivo: el
constructor corre dentro del computed `externalValue` → getter-tubo → pisado fantasma.

Qué es externalidad: `_currency` NO lo es (campo real del doc, alcanzable por localInput/rootBus); `locale` y `mask` SÍ
(son del usuario: back `$locals.locale`/`req.locale`, front el store de Config).

## La máxima del componente pelado

Un VO que necesita PARCHAR su componente está malo, o tiene externalidades que no puede controlar sin ayuda.

- Sin externalidades → el componente queda VACÍO: con suerte `$options.VO = Rut`. ItdRut está vacío a propósito.
- El GI viene parchado para VOs instanciados: si el VO soporta el hook homólogo (initVal/formatter/emitter/keypress/
  validate…) el GI lo usa; si no, FALLBACK al flujo clásico del GI.
- Con externalidades (Currency: locale/moneda/mask) el componente justifica SOLO el cableado (watchers → setters al
  singleton). Todo lo demás (pisar emitter, formatM, refreshes, herencias por binding) es olor a parche: se revisa el
  VO o el GI, no se engorda la hoja.

Vara de revisión: cuenta las líneas del componente que NO son cableado de externalidades; cada una es deuda.
