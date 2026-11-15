# Pruebas: la vertical XLS y PDF, el ritual manual y el grafo — detalle

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la plantilla.

#### 🔴 Componentes y tipos propios: la vertical se prueba COMPLETA, hasta XLS y PDF

Un tipo o un componente no termina en la pantalla. El mismo valor **se descarga en planilla y se
imprime en documento**, y esas dos son salidas de primera clase, no un extra.

⟹ **Todo TDD de componente o tipo propio incluye, obligatoriamente, un caso de descarga XLS y uno de
generación PDF.** Sin eso el nivel 1 NO está cubierto: falta el tramo final de la vertical.

**Por qué justo ahí y no en otro lado:** es la única salida **irreversible** —un contrato o una
planilla que ya salió al cliente no se corrige— y es la que **más depende de contexto goteado** (el
locale, la moneda, el request). Un test unitario del objeto de valor no lo ejerce: el objeto formatea
bien aunque el pipe que le entrega el locale esté roto. Es exactamente el hueco que hay que cerrar.

**Y son baratas**: `toPDF` devuelve un `{text, ...style}` plano → se afirma sobre el objeto, **sin
renderizar el archivo**. Mínimo: un valor normal con dos locales distintos, y el valor vacío.

#### 🔴 Una prueba que se corre A MANO no es una prueba: es un ritual

Al definir cada caso hay que decir **cómo se ejecuta solo**. Si la respuesta es *"se deja todo en modo
debug, se arma un caso grande y se van mirando los edges"*, ese caso **está mal definido** y no se
aprueba así — porque **nadie repite un ritual de una hora**. Se corre una vez, se anota el resultado, y no
se vuelve a correr nunca.

🔴 **Y ahí viene el daño, que no es no-probar sino algo peor: el número CADUCA callado.** Una medición vale
solo mientras viva el régimen en que se midió. El sistema cambia después, y el resultado se sigue citando
como vigente porque re-medirlo cuesta una hora. Queda una certeza fósil: creemos que está probado, y está
probado *otro* sistema.

⟹ **Si el resultado esperado de un caso es un NÚMERO o un CONTEO** —cuántos componentes reaccionaron,
cuántos requests salieron, cuántos ms tardó, "¿se despertó alguien más?"— **el caso se define desde el
principio como ejecutor automático**. El test es lo que ata el número a su régimen: si el régimen cambia,
se cae ese día y no dos años después.

Litmus al escribir la fila: *¿el resultado es un número o un "¿reaccionó alguien más?"* → es ejecutor
automático, no inspección. (El costo suele ser mucho menor de lo que parece: la infra de prueba y los logs
que dicen quién reaccionó ya existen; falta la aserción.)

#### 🔴 Las pruebas son un GRAFO, no un árbol (jcmunoz 2-oct-2026)

"Tengo este requerimiento, le hago un test" produce un árbol con duplicados. La pregunta va al revés: **con mi set
de pruebas, ¿queda todo el contrato encadenado o hay nodos colgando?**

| Regla | Qué significa |
|---|---|
| cada test declara **qué cubre** | los nodos del contrato que recorre (de diseño, sistema y funcionales); un test cubre varios nodos y un nodo puede quedar cubierto por varios tests |
| se agrega un test solo para un **nodo colgando** | la revisión busca los nodos sin cobertura, ve a qué corresponden, y recién ahí escribe uno |
| **no se prueba en una prueba la base de las demás** | si N specs recorren un mecanismo, un spec dedicado a él no aporta: si el mecanismo se rompe, caen todos; si cae uno solo y a ratos, es entorno o el spec (rule `e2e-siempre-chrome-real-y-al-dia`, paso 0) |
| **dos pruebas con intent distinto que hacen lo mismo son una** | se saca la redundante; no se fusionan en una nueva |

Caso: `itd-t-shared` (translate) probaba "redefinir → PUT → `mutate({force})` → aviso del SW → repintar", que ya
recorrían `nullify`, `attr-href`, `grid-width`, `not-translatable` y `status-colours`. Falló 2 de 4, se le culpó a un
cambio ajeno sin correlación, y a mano funcionaba siempre. Se sacó.

