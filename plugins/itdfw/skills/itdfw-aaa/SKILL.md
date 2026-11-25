---
name: itdfw-aaa
description: Use when deciding WHO the users of an ITDFW system are and WHAT each one may do — before writing a TDD's actors, models or screens, and whenever a design says "the owner", "the cashier", "the seller", "a customer", "staff", "admin", "invite a user", "who can reverse", "roles", "profiles" or "levels". Defines the three A's in domain terms: Authentication (which user types exist, which are clones of User, who creates whom), Authorization (base profile vs assigned profiles, levels, capabilities as assignable functions, scope along the chain, one interface per level of friction) and Accounting (what leaves a trail). No code: how to write the model is itdfw-models, how an endpoint authenticates is itdfw-api-system.
---

# ITDFW AAA — quién es quién y qué puede cada uno

La definición de los usuarios de un sistema va **antes** que el modelo y que las pantallas. Si se salta, el TDD
mezcla gente de un cliente con los admins, y la interfaz promete lo que el AAA no da. Esto es dominio, no código.

## 1. Autenticación — quién es quién

### 🔴 La regla base (una sola; lo demás se deriva)

> **`User` es solo para los admins de quien administra el deploy. Cualquier otro usuario es un clon de `User`.**

| Caso | Quién es `User` | Quién va clonado |
|---|---|---|
| un SaaS que administramos nosotros, **aunque sea un site por cliente o por evento** | nosotros | todo cliente y todos sus usuarios |
| una app vendida, cuyo dueño tiene usuarios externos | los admins del dueño (se corre un eslabón) | los usuarios externos del dueño |
| una app de puros usuarios internos que **no** administramos | todos | nadie: es el único caso sin clones |

- No se pregunta ni se discute: en un SaaS, el usuario de un cliente es un clon **tenga las funciones que tenga**.
- Un clon por **tipo** de usuario (el organizador, la caja, el vendedor), no por perfil.
- Si un tipo crea a otro, el creado es otro clon. El padre nunca crea un `User`.
- 🔴 **Si uno depende del otro, es otro tipo**: el vendedor cuelga del dueño del stand, así que son dos clones aunque
  tengan la misma forma. Juntos, el admin tendría que sobrecargarse (filtros, campos condicionales, "si es dueño…")
  solo para separarlos.
- **Por qué sale más fácil** (el litmus de la paja: *¿cuál es la forma de no reimplementar nada para controlarlo?*):
  cada clon tiene su propia lista, y el prefiltro del modelo pregunta el tipo de quien llama. Si es `User`, ve todo y
  filtra a su pinta; si es un dueño de stand, ve solo los de su stand. Ver a los dueños o a los vendedores es directo,
  y ver "mis vendedores" es trivial.
- 🔴 **Un usuario pertenece al nivel que contiene todo lo que puede hacer.** El cliente que participa en varias ferias
  pertenece al sistema, no a una feria, y su paso por cada feria es una relación. El vínculo inmutable con un padre lo
  lleva solo quien vive dentro de un único segmento (la caja en su feria, el vendedor en su stand).

### Cómo entra cada tipo

| Entrada | Cuándo |
|---|---|
| **lo crea su padre** | el caso normal de un SaaS: el organizador crea su caja; el dueño de un stand, a su vendedor |
| **se registra solo** (`registrable`) | un cliente final sin nadie arriba (un asistente, un socio que se inscribe) |

- El vínculo con el padre (su feria, su stand, su empresa) **lo pone el back desde quien crea, nunca el body**, y es
  **inmutable**: una cuenta creada en A no se mueve a B.

## 2. Autorización — qué puede cada uno

### 🔴 El corte: el primer nivel tiene perfil forzado; sus subusuarios, perfiles asignados

| Tipo | Perfil | Por qué |
|---|---|---|
| **el primer nivel**: la cuenta del cliente, la que crea el admin de quien administra el deploy (el organizador de la feria, la empresa cliente) | **perfil base forzado, sin `profiles`**: nadie le asigna perfiles especiales. A lo más se le agrega algo **a su perfil base**. Si necesita capacidades distintas o de más, eso va **por contrato** (lo que contrató ese cliente), no por un perfil a mano | está restringido por perfil siempre, se le den los permisos que se le den |
| **todo subusuario**: los que crea el cliente o un subusuario suyo (la caja, el dueño del stand, el vendedor) | **perfiles asignados por su padre**, nunca por encima del level del padre | si no, habría que hacer un clon por cada perfil |
| quien **se registra solo** (`registrable`) | perfil base forzado, sin `profiles` | no tiene a nadie arriba que le arme el perfil |

- El **perfil base** se llama igual que el tipo y trae lo mínimo; puede no traer nada más que ver y editar su propio
  perfil.
- La cadena de **levels** baja con la de creación (admin → organizador → caja → vendedor): cada padre reparte solo
  dentro de lo que su level le deja.

### Capacidades, scope e interfaz

- 🔴 **El plugin define CAPACIDADES, no a quién pertenecen.** Cada capacidad (cobrar, revertir, cerrar el día) es una
  función asignable; el TDD a lo más sugiere en qué perfil base va por omisión. "Solo el dueño revierte", escrito en un
  contrato o en una punta, es programar una asignación: es hallazgo.
- **"Lo suyo" es scope y va en la punta**: cada padre ve solo lo que cuelga de su cadena (su feria, su stand).
- 🔴 **Una interfaz junta solo lo que se implica.** Para cada par de capacidades: *si puedo hacer X, ¿por el hecho de
  poder hacerlo puedo hacer Y?* Si sí, es la misma punta con otra extensión, en la misma interfaz. Si no, son
  capacidades distintas, y una interfaz que las junta promete algo que el AAA puede no darle a quien la usa.
- **Una pantalla por perfil.** La plata la ve solo quien cobra.
- Un TDD o una demo con un solo perfil está incompleto: da a entender que todos pueden todo.

## 3. Auditoría — qué queda registrado

| Qué | Cómo |
|---|---|
| quién creó o cambió cada documento | lo pone el FW (usuario y fecha de creación y de cambio); no se declara |
| los hechos de negocio (una venta, un cierre) | la `Bitacora` del modelo (`itdfw-models` §4) |
| 🔴 **una reversa** | **cuesta a propósito**: la hace otra persona, en otra pantalla, con **motivo obligatorio y rastro**, nunca quien hizo la operación. Si equivocarse no cuesta, nadie se cuida, y abre la colusión (vendo, reverso y me quedo con el papel) |

## 4. Checklist del TDD (sección Actores y Modelo)

- [ ] Cada tipo de usuario está nombrado y es un clon, o es un admin de quien administra el deploy (tabla §1).
- [ ] Por cada tipo: quién lo crea, su vínculo inmutable y si está restringido por perfil (§2).
- [ ] Las capacidades son funciones asignables, con su perfil base sugerido, sin "solo X puede".
- [ ] Cada pantalla pertenece a un perfil y no junta capacidades que no se implican.
- [ ] Cada reversa es de otro perfil, con motivo y rastro.

## El cómo técnico, en otro lado

| Para | Skill |
|---|---|
| escribir el clon (`safeClone`, el perfil forzado en `pre("validate")`, identidad inmutable, `registrable`) | `itdfw-models` → `references/authenticatable.md` |
| cómo una punta autentica (sesión, JWT, `x-itd-access`, anónimo) y cómo se resuelve el acceso | `itdfw-api-system` → `references/aaa-access.md` |
| dónde va esta sección en el TDD | `tdd-narrativo` §2b |
