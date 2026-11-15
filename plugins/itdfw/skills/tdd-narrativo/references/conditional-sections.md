# Secciones condicionales del TDD (§2d, §2e, §2f)

Aplican según el tipo de módulo. El `SKILL.md` trae el litmus de cada una; acá está la regla completa y el caso que
la originó.

## 2d · 🔴🔴 Si el dominio es una NORMA EXTERNA, se lee la norma VIGENTE antes de escribir una línea

Hay TDD cuyo dominio no lo definimos nosotros: un protocolo (OAuth, OIDC, MCP, WebAuthn, SAML), una RFC,
una spec de un proveedor, una normativa legal (facturación electrónica, protección de datos), el contrato
de una API de un tercero. En esos casos **el TDD no es diseño: es implementación de algo ya escrito.**

🔴 **Y ahí un TDD escrito "de memoria" es peor que no tenerlo**, porque hereda el mismo defecto que este
skill vino a matar. El TDD tautológico prueba lo que el dev entendió del requerimiento; un TDD de norma
escrito de recuerdos prueba **lo que el modelo recordaba de la norma** — y lo prueba en verde, con
seguridad, contra un estándar que puede haber cambiado.

⟹ **Antes de escribir la sección Modelo de un TDD de norma, se trae la norma.** No se negocia:

| Paso | Qué |
|---|---|
| 1 | **Identificar el corpus**: qué RFC/spec/normativa aplica, y cuál es la **versión VIGENTE HOY** (fecha, número de revisión, estado del draft) |
| 2 | **Traerla de la fuente**, no de la memoria: sapeo dirigido, con URL y sección citada. Es exactamente para esto que existen los esclavos |
| 3 | **Jerarquizar**: qué es `MUST`, qué es `SHOULD`, qué es `MAY`, qué está **deprecated**. El TDD escribe esa clasificación, no la resume |
| 4 | 🔴 **Mapear el CHOQUE entre la norma y la realidad**: qué implementan de verdad los clientes/servicios con los que vamos a hablar. Puede que la norma haya deprecado algo que todo el mundo sigue usando — o al revés |
| 5 | Recién entonces, el Modelo y las pruebas |

**El paso 4 es el que nadie hace y el que más cuesta.** Cumplir la norma no es el objetivo: el objetivo es
que la cosa funcione con quien está del otro lado. Un emisor impecable según la spec, al que ningún cliente
existente se puede conectar, es un emisor que no sirve. Y al revés, implementar lo que "todos usan" sin
saber que está deprecated es construir sobre algo con fecha de muerte. **Las dos mitades van en el TDD**,
declaradas por separado.

🔴 **Y ojo con la fuente de la fuente**: el conocimiento del modelo que escribe el TDD tiene MESES de
antigüedad. En un dominio propio eso no importa (el código está ahí para mirarlo); en una norma externa es
justo lo que caduca. **La antigüedad no se percibe desde adentro**: recordar mal se siente exactamente
igual que recordar bien.

**El caso que lo prueba (2026-09-10, plugin `openid`):** se escribió el nivel 3 completo con el registro
dinámico de clientes (RFC 7591) como pieza central — modelo, puntas, casos, decisiones blindadas. Un sapeo
posterior encontró que la spec vigente de MCP (2026-07-28) lo marca **`MAY` y deprecated**, *"retained for
backwards compatibility"*, y que lo preferido (`SHOULD`) es otra cosa que el TDD ni mencionaba. El nivel
completo hubo que parquearlo. jcmunoz: *"esto no es diseño personalizado, es diseño sobre la RFC ya
establecida... no podemos hacer el TDD de recuerdos, hay que mamarse toda la documentación necesaria antes
de definir el TDD"*.

**Litmus para saber si tu TDD cae acá**: *¿el nombre de lo que estoy escribiendo lo eligió alguien de
afuera?* Si en el TDD aparecen siglas que no inventamos nosotros —un número de RFC, un `grant_type`, un
`.well-known`, un código de un organismo— el dominio es normativo y aplica esta regla.

## 2e · 🔴 Antes de definir QUÉ construir, definir qué NO construir: adoptar → adaptar → implementar

Es el paradigma con que está hecho el framework entero, y es de jcmunoz (2026-09-10): *"no reinventar
nunca la rueda, tratar de adaptarme y usar lo mejor en base a mis requerimientos"*. El FW existe por esta
lógica aplicada una y otra vez.

**El orden, y el costo declarado de cada paso:**

| Paso | La pregunta | Si sí | Ejemplos reales del FW |
|---|---|---|---|
| **1. ADOPTAR** | ¿alguien lo provee, **y me sirve como lo definió**? | se usa tal cual, sin envolturas de adorno | express, mongoose, connect-mongo |
| **2. ADAPTAR** | ¿está cerca pero no calza? | se adapta **y se levanta el issue upstream** | `autoincrement` con singleton |
| **3. IMPLEMENTAR** | ¿no existe, o lo que existe no sirve? | recién acá se escribe | `Mutex`, `PubSub`, `SSE` |

🔴 **El paso 2 tiene un costo que hay que declarar en el TDD, no descubrir después**: el issue puede no
recibir respuesta nunca (le pasó al del `autoincrement`). ⟹ "adapto" significa **asumir el mantenimiento
del parche por tiempo indefinido**, incluida cada actualización de la dependencia. Si eso no se puede
sostener, la respuesta honesta es 3, no 2.

🔴🔴 **Y el orden dentro del paso previo importa: los MUST/SHOULD/MAY se declaran ANTES de mirar el
catálogo.** Al revés, el requisito se acomoda solo a lo que el candidato ofrece: miras una librería, ves
que no trae X, y sin darte cuenta X baja de `must` a `may` para que el candidato califique. La vara se
pone antes de conocer a los candidatos, y queda escrita en el TDD. Después se evalúa **cada candidato
contra esa vara**, no la vara contra el candidato.

⟹ **La sección va en el TDD**, aunque el veredicto sea "lo implementamos": lo valioso es el registro de
**qué se evaluó y por qué no sirvió**. Sin eso, dentro de seis meses alguien vuelve a proponer la misma
librería, y no hay forma de saber si ya se descartó o nadie miró.

Cuando el veredicto es adoptar o adaptar, el TDD declara además: versión fijada, licencia, estado de
mantenimiento (último release, ¿hay quien responda?), y **qué parte del contrato queda en manos ajenas** —
porque eso es lo que hay que probar distinto: lo propio se prueba por dentro, lo ajeno se prueba por su
frontera y con un canario que avise si cambia de comportamiento al actualizar.

**Hermana hacia adentro**: la rule `fw-ya-lo-provee` hace la misma pregunta sobre el **framework** (¿la
pieza ya existe en `libs/`, en las options del modelo, en lo inyectado al `req`?). Esta la hace sobre el
**ecosistema**. Se consultan en ese orden: primero el FW, después el mundo, y al final tus manos.

## 2f · 🔴 Si el módulo YA OPERA, el TDD audita lo que va a mudar — y lo audita CORRIENDO

Hay TDD que no nacen sobre una hoja en blanco: empaquetar como plugin algo que hoy vive en el core,
migrar de tecnología, reescribir un front, externalizar una lib. En todos, una parte **ya funciona en
producción** y el plan es mudarla.

🔴 **Y ahí opera un sesgo que no falla nunca: lo que ya funciona se presume correcto.** Nadie audita lo
que va a copiar tal cual. El TDD dice "se muda como está", el implementador muda como está, y el defecto
viaja **adentro** del paquete y se estrena como nuevo en otro lado — con años de antigüedad y ahora con
el aval de un TDD aprobado.

⟹ Van **DOS secciones, no una**. Se confunden todo el tiempo porque las dos hablan de "lo que hay", pero
responden preguntas distintas:

| Sección | La pregunta | Qué produce |
|---|---|---|
| **Diferencial** | *¿qué pieza existe, cuál falta, cuál quedó atrasada?* | el plan de la mudanza |
| **Defectos heredados** | *¿qué viene MALO en las piezas que sí están?* | la decisión de arreglar o heredar |

**Las reglas de la sección de defectos:**

1. 🔴 **Se verifica CORRIENDO, no leyendo.** Un defecto leído en el código es una **sospecha**, y una
   sospecha declarada como hecho contamina el TDD igual que un recuerdo de una RFC (§2d). Lo probado entra
   como hecho **con cómo se probó**; lo demás entra marcado como sospecha **y con la prueba que lo
   destaparía**.
2. **Cada fila cierra con una decisión: arreglar en la mudanza, o heredar y anotar.** La toma el dueño,
   fila por fila. **Heredar en silencio es exactamente lo que hace que un defecto cumpla años.**
3. **Lo que se decide arreglar entra a las tablas de prueba.** Si no tiene caso, no se arregló: se cambió
   de lugar.
4. **Las puntas abiertas se auditan primero.** Es donde el defecto viejo cuesta más caro y donde menos se
   mira, porque "lleva años andando".

**El caso que lo prueba (2026-09-10, plugin `translate`):** el TDD ya declaraba *"el modelo no se
rediseña, se muda"* y traía su diferencial completo, pieza por pieza. Al preguntarse por primera vez **qué
viene malo**, dos peticiones anónimas contra el sitio de desarrollo bastaron: la única punta abierta a
internet **se cae con parámetros incompletos y contesta el rastro del programa, con las rutas del
servidor**; y como el error no es controlado, además le llega al administrador por correo — o sea que
cualquiera puede llenarle la casilla pidiendo mal a propósito. Llevaba años ahí. Salieron ocho defectos:
cinco verificados, tres por verificar. jcmunoz: *"este TDD es distinto al resto, este nace para crear un
plugin sobre algo q ya opera, entonces el diferencial entre lo actual y lo correcto puede q falte"*.

**Litmus para saber si tu TDD cae acá**: *¿alguna parte de esto ya está corriendo en alguna parte?* Si la
respuesta es sí —aunque sea *"sí, pero lo vamos a reescribir entero"*— la sección va.

## 2g · Superficie de ataque — contra quién se defiende el módulo

**Litmus**: *¿el módulo recibe de afuera algo que el back usa para ACTUAR (una URL a la que llama, un host, código, un
tamaño, una llave de config), o gasta plata nuestra?* Si sí, la sección va.

### Los actores

| Actor | Lo controla | Puede ir contra | Quién lo ordena |
|---|---|---|---|
| anónimo | nada | el site | AAA |
| externo (socio, cliente) | sus datos | otros usuarios del site | AAA + `query` |
| interno (staff del site) | lo que su perfil le da | lo que le dio su admin | el cliente: es su decisión de acceso |

AAA ordena a los tres. Lo que el módulo agrega es lo que AAA no ve: qué hace el back con lo que esos actores le
entregan. Por cada entrada, una línea y un caso que lo haría fallar:

| Pregunta | Si la respuesta es sí |
|---|---|
| **SSRF**: ¿el back llama a una URL o host que entregó un actor? | se valida contra una lista fija en el código (no en Config) |
| **DoS**: ¿un actor puede hacer trabajar al back sin límite (tamaño, cantidad, recursión)? | límite declarado y probado |
| **DoW** (denial of wallet): ¿un actor puede gastar plata nuestra (IA, SMS, mapas)? | `req.browserAuth` + cuota (skill `itdfw-api-system`) |
| **Config**: ¿una llave editable por el admin abre algo de lo anterior? | no va en Config (rule `config-nunca-abre-un-hoyo`) |

Caso canónico (30-oct-2026, plugin `notifications`): `subscribe` guardaba cualquier `endpoint` y el back le hace POST
en cada aviso (así funciona Web Push, RFC 8030); un cliente podía apuntarlo a una IP interna, y la punta `send`
devolvía lo que esa IP contestaba. Arreglo: `https` y solo los cuatro servicios de push, fijos en el código. El hoyo
lo cazó una revisión automática, no el TDD: nunca habíamos pensado al atacante desde esa posición.

### Para servicios SaaS (cualquier multi-tenant) — además

En un SaaS aparecen dos actores que el AAA no ordena, y un plugin diseñado para SaaS los declara:

| Actor | Lo controla | Puede ir contra | Quién lo ordena |
|---|---|---|---|
| **admin del tenant** | todo SU site: datos, perfiles, Config nivel 2 | **nuestra infraestructura y los otros tenants** | el módulo, en el código: nada de lo que él configura puede alcanzar lo nuestro |
| **arquitecto del SaaS** | qué capacidades se le dan al tenant | todo, si le da código o salidas libres | la infraestructura (abajo) |

🔴 **Un SaaS se vende en TRES niveles de aislamiento, y el TDD declara para cuál se diseña** (jcmunoz 2-nov-2026). El
nivel lo decide lo que el cliente paga, no el gusto del diseño:

| Nivel | Cómo se aísla | Para quién |
|---|---|---|
| **alto** | máquinas y motores propios: aislamiento 100 % | el cliente que paga infraestructura dedicada |
| **medio** | un site y una BD por tenant (`mongoURL` por site), con su propio usuario de Mongo sin privilegios sobre las otras bases; comparten máquina y motor, aislados por worker y por BD. Cuesta ~250 MB × `Procs` por tenant | el cliente que paga su porción de infraestructura |
| **bajo** | un solo site que crece por cantidad de clientes; el aislamiento es un **prefiltro** (`query` del modelo): los clientes entran por un modelo autenticable propio, y el prefiltro mira qué modelo es el usuario actual: si es cliente, filtra por lo suyo; si es usuario interno, ve todo | el volumen que no paga infraestructura; con un site por cliente saldría muy caro |

Consecuencias para el TDD:
- **Medio y alto**: lo que un tenant haga dentro de su BD (un pipeline libre, un `$lookup`, un `$out`) solo alcanza sus
  datos; el módulo **no recorta capacidades** para defender a un tenant de otro (caso del plugin `kpi`, 30-oct: la lista
  blanca de etapas se descartó porque el hoyo era compartir la BD).
- **Bajo**: comparten BD, así que el módulo **sí recorta**: nada que el cliente configure o escriba puede saltarse el
  prefiltro (pipelines libres, `DBModelRaw`, Tools, `$lookup` a otra colección), los índices únicos incluyen al dueño, y
  cada modelo con datos del cliente declara su prefiltro y su caso de cruce (el cliente A no ve, no edita ni adivina
  los datos de B). Son dos ramas que no se mezclan: el **prefiltro** del modelo decide qué se muestra (filtro forzado,
  se suma a lo que pida el front); el **`query` del type** de cada ref decide qué referencias son válidas al asignar,
  para que un cliente que conoce un id ajeno no lo enchufe a mano. 🔴 El nivel 1 de un SaaS de nivel bajo se prueba con
  **varios clientes y pruebas cruzadas, headless y e2e**: con la sesión de A se intenta leer, editar, borrar y
  **asignar como referencia** lo de B en cada par de modelos iguales, y se verifica que `getRef` (por `formOptions`) y el
  `simpleName` de la ref corran sobre el `query` del type (jcmunoz 2-nov-2026: el riesgo no es el FW, es un dev que
  define mal el prefiltro o el `query`).
- **Zones** no es un nivel: es el caso especial de UN cliente con varios tenants que quiere verlos todos juntos. Se
  decide por servicio y va apagado por omisión.
- 🔴 **En un SaaS compartido, lo que se define con código o consulta libre es NUESTRO** (jcmunoz 2-nov-2026): KPI, ML,
  `DBModelRaw`, `DBAPI`, Tools de `ai` y similares los implementamos y activamos nosotros; el tenant usa el resultado
  (sus KPI, su modelo entrenado) pero no los define. La defensa es el guard de quién puede qué: **esas capacidades nunca
  se asignan a un perfil de tenant** en un SaaS compartido, y el TDD lo declara con su caso (el perfil del tenant no
  las tiene). No hay interruptor por nivel ni se recortan los módulos. El que quiere KPI o ML propios necesita infra
  exclusiva (nivel alto), donde el owner tiene acceso a todo porque es su plataforma. El control fino (restringir y
  analizar campos para que un tenant defina los suyos sin meter las garras) es un servicio que se cobra, no el default.

Lo que el módulo no puede contener, y es responsabilidad del arquitecto del SaaS:

- **Código de tenant** (`DBModelRaw`, `DBAPI`, Tools de IA, plugins): corre con el poder entero del back.
  `module-from-string` usa el `vm` de Node con `useCurrentGlobal: true` (ve `process.env`, `configGet`, `pool`) y
  puede importar `fs`, `child_process` y `net`; Node documenta que `vm` no es un mecanismo de seguridad. Una revisión
  del código por un revisor sirve de alarma, no de muro.
- **Salidas legítimas** (webhooks de salida): no se pueden fijar en una lista, y también pueden apuntar adentro.
- **El muro**: servicio con usuario sin privilegios y `PATH` mínimo, chroot o contenedor por tenant, permission model
  de Node, y egress filtrado (internet sí; rangos privados, loopback y la metadata de la nube no). Eso deja pasar los
  webhooks y corta el escaneo.

🔴 **Esto se verifica en máquinas de QA o en el proveedor de nube**, con la topología real (red, contenedores,
reglas de salida). Una prueba local no certifica nada de esta tabla: la máquina de desarrollo no tiene ni el
aislamiento ni la red del SaaS.
