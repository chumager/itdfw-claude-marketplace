# Red flags

## Red flags

| Si te ves… | Para |
|---|---|
| escribiendo tests después de que el código funciona | es el TDD tautológico: no prueba el requerimiento |
| describiendo un caso con vocabulario de tu implementación | ya lo contaminaste con tu diseño |
| viendo verde a la primera sin haber escrito código | el test está malo |
| justificando un caso con "por si acaso" | escenario que no existe |
| corriendo la suite después de varios cambios | no vas a saber cuál rompió qué |
| envolviendo, adaptando o marcando una pieza NUESTRA de esta misma pega (wrapper, literal con getters, `defineProperty`, `{...obj, x}`) | PLR instantánea: la firma es nuestra y se cambia; envolver es parchar de fábrica |
| dando "listo" con la suite verde sin haber leído el código contra el contrato | solo verificaste tests; el código se asume y las decisiones sin documentar pasan sin que nadie las vea |
| escribiendo un TDD con siglas que no inventamos nosotros (una RFC, un `grant_type`, un `.well-known`) **sin haber traído la norma vigente** | estás escribiendo de memoria una norma que pudo cambiar, y tu memoria tiene meses (§2d) |
| escribiendo "se muda tal cual" sobre algo que ya opera, **sin haber probado qué le pasa hoy** | lo que ya funciona se presume correcto, y así es como un defecto de años viaja adentro del paquete nuevo (§2f) |
| razonando el front con gramática de back (o al revés) | declara el scope y vuelve a leerlo |
| cerrando el TDD de un componente o tipo propio sin caso de XLS ni de PDF | la vertical quedó a medias: falta la salida que se le entrega a un tercero |
