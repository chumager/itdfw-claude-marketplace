# Por qué el contrato es así — historia y decisiones

> El contrato corto vive en `SKILL.md`. Aquí está el porqué de cada regla y cómo se llegó a ella.

## El contrato reemplazó al canon "VO inmutable"

La inmutabilidad dura era dogma custodiando una puerta sin camino. Piloto del core: **Rut** (la base simple); luego
Currency (el completo).

## El fin del dogma inmutable (`setValue`)

La inmutabilidad dura del `#value` protegía UNA cosa práctica: mutar in place = mongoose no se entera = no dirty = no
persiste (el hoyo del Rut original). Pero en mongoose **nadie llama `setValue`**: el idioma es `doc.campo = v` (recast)
y la aritmética pasa por `Symbol.toPrimitive` (recast al reasignar). La barrera custodiaba una puerta sin camino. Se
soltó el dogma con una RED de fábrica: el caster pasa el `this` del SchemaType al constructor, la clase conoce su
path y `setValue` se auto-ensucia (`#doc.markModified(#path)`), así que la mutación invisible al dirty-tracking es
imposible por construcción.

**Por qué `setValue` no valida.** El flujo lo demuestra: VSV → assignVSR → para VALIDAR se necesita el formateado →
el formatter necesita el valor YA en el VO → la asignación va ANTES de la validación por construcción del pipeline. Un
`setValue` que valida invierte el orden del proceso. El estado intermedio inconsistente es legítimo: la clase es
transitiva y vive siempre.

## El pecado original del constructor

"Constructor = firma del cast" amarraba la clase al esquema de UN consumidor (mongoose): reinstanciación perpetua,
constructor fijo y el timing ambiental como problema del dev. La forma final separa tres fases (valor / setters de
ambiente / `static cast` opcional), y el ambiente entra por goteo cuando llega: no se puede saber cuándo cambia ni en
qué etapa está, así que la instancia se arma al ritmo del ambiente (hydrate en el back, lazy/async en el front, da lo
mismo el orden).

**Construcción TOTAL** mata el dogma "jamás existe inválido", que validaba en el peor momento (la construcción, con el
ambiente a medias), y con él los guards de timing y los FCC-checks defensivos.

## Por qué no hay clase base

Una base `DomainObject` con `#value` está muerta por construcción: los `#private` no se heredan, así que el hijo no
puede operar su valor (¿un `formatter` que no puede leer lo que formatea?). Darle getter/setter público "para que
opere" hace que el privado ya no sea privado: acceso total sin transformación = protección ceremonial. La base cobra
flexibilidad y paga con seguridad falsa. El contrato es de COMPORTAMIENTO, no de estructura, y por eso se verifica con
un módulo de conformance externo. Sirve también para auditar las clases existentes (Address, Duration) sin
acoplamiento estructural.

## Cómo nació el VO compuesto

Del descuadre del motor de cuotas: "compute RAW + la capa redondea" era definirse por condicionantes EXTERNOS. El back
redondeaba de carambola vía setters de mongoose y el front no redondeaba, así que la dispersión se acumulaba y la
validación por reconstrucción estaba condenada por diseño: un peso corrido con premisa de identidad invalida la premisa,
y la tolerancia era la alfombra. Canon: `FeeFullClass`.

**La lección de las tasas.** Un cap de precisión en una tasa genera bloques de error groseros sobre capital grande; el
display a 2 decimales escondía 0,8333 % como 0,83 %: la pintura capada, el cálculo intacto. Por eso las tasas son raw
puro y su `precision` es solo de display.

## Orden de implementación que siguió el core

1. **Rut**: el núcleo del contrato sin challa (instancia-siempre, `setValue` triple, validate transversal de esencia,
   auto-dirty). Sin anillos 2 y 3.
2. **Currency**: el completo (externalidades por wrapper, pub/sub, formatters, hooks GI).
3. Rama futura: distribuir las clases de types al front para los types del core o del DEFAULT que no vienen en un FWP.

## Labels singulares (cómo se verificó)

Verificado con una matriz de conteos 1/2/5/10/20/100/1000 en 12 locales: no existe "plural genérico" sin conteo
(eslavos 3 formas, árabe 5, galés muta la raíz).
