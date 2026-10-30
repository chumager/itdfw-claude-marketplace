# Eval green/red — TableViewValue (getTableViewValue)

> Test que el skill DEBE poder responder bien una vez que exista el reference de TVV
> (`references/table-view-value.md`, pendiente 2026-07-09). Origen: gap detectado — `getTableViewValue`
> aparece UNA sola vez en el skill (SKILL.md sección Copy) sin estructura definida.

## PROMPT (lo que pregunta el usuario)
"cajarito, necesito cambiar lo que se renderiza en el componente X, que es hijo de String, no sé si
crear una función de renderizado a mano o si tengo otra forma de cambiar lo que se ve, me ayudas?"

## GREEN — la respuesta correcta DEBE:
- Apuntar al override de `getTableViewValue` como la vía del FW para cambiar el VALOR que se muestra
  en view/grilla/option, SIN escribir un render a mano.
- Distinguir explícito: cambiar el VALOR mostrado (getTableViewValue, sobrecargable) ≠ cambiar el
  RENDER/dibujo (renderView y familia). El usuario casi siempre quiere lo primero.
- (pendiente definir con jcmunoz) cómo se sobrecarga, firma, quién lo llama, y cómo las options
  muestran su valor a través de él.

## RED — la respuesta INCORRECTA (que NO debe dar):
- Saltar a inventar un `renderView`/función de render a mano cuando `getTableViewValue` es la palanca.
- Confundir el RENDER (dibujar) con el TVV (calcular el valor mostrado).
- Mandar a sapear el core para deducir el mecanismo (debe estar en el skill).
