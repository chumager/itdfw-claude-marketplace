# Traducción en el front: quién declara, quién rinde, cómo se prueba

Contrato completo: el TDD del plugin `translate`. Este reference responde cómo se declara, se rinde y se prueba la traducción en el front.

## Las puertas (globales del pack, sin import)

| Global | Devuelve | Cuándo |
|---|---|---|
| `rt(context, subcontext, text, attrs?)` | vnode `ItdT` | texto que se pinta en el DOM. **Preferida**: trae borde, lápiz y editor in situ |
| `t(context, subcontext, text, {data, separator, onlyTranslated}?)` | `computed` | texto que NO tiene nodo propio: placeholder, `emptyText` de una grilla, mensaje a un store, aria |
| `leaf.useTranslation(ctx, sub, text, {onChange}?)` | la Query de smart-fetch | solo para el que necesita `status`/`mutate` (el editor); importado de `core/lib/translation.js` |

`t` y `rt` son **globales inyectados por el pack** (`init.js` del core, bloque `t`/`rt`/`localT`): no hay
import que seguir, así que ni Serena ni el grafo listan sus llamadores. La única vía para "¿quién usa `t()`?" es
texto: un `grep` de `t(` y `rt(` sobre el core front, NUI y los `vue/` de los plugins ). Cualquier otra `var` del pack que un componente necesite se expone igual: como global desde su bloque
del `init.js`, nunca leyendo `vars` desde el componente.

## Dónde se declara y dónde se lee (el side effect)

**Siempre sé qué voy a traducir**: un componente declara sus textos en `created()` (Options API pura, se hereda por
`extends`) y el render solo lee `.value`. Declarar en el render o en un `computed` crea una Query por reevaluación y
la página cicla (max recursive updates). Lo que cambia después son los argumentos (`mutate({params})`), no qué texto.

```js
created() { this.emptyText = t("ItdGrid", "empty", "No hay datos para mostrar"); },
render() { return <span>{this.emptyText.value}</span>; }   // o rt(...) directo en el render: ItdT declara por sí mismo
```

`rt()` sí puede ir en el render: el nodo `ItdT` declara su Query en su propio `created()`.

## Norma de coordenadas (resumen; la tabla completa en el TDD §8)

- Textos del modelo: `Model-<m>/field-<x>`, `description-<x>`, `placeholder-<x>`. En un campo anidado `<x>` es el path completo (`field-functions.path`); las options van en `options-<x>`.
- Textos del componente: `<Componente>/rol` (literal, jamás `$options.name`), **una sola coordenada** aunque haya
  modelo alrededor: nadie quiere un "No hay datos" distinto por modelo.
- Textos genéricos de un **plugin**: `plugin:<nombre>/<Componente>.<rol>`, con `<nombre>` la key con que el plugin
  registra su front (`plugin:translate`, `plugin:restaurant`). Un texto heredado conserva la coordenada de quien lo
  declaró; el hijo solo declara los nuevos (detalle en `itdfw-translate` §3).
- Compuestos: el padre declara `childrenModel` para que los sub-inputs traduzcan bajo el modelo que corresponde;
  pasarle `model` al GI hijo no alcanza porque el wrapper lo crea el form padre.
- El locale es parte de la coordenada: viaja en el query string, una URL por idioma. `Vary` no existe para nosotros.
- El locale vigente sale del store: `store.getters["Config/getLocale"]` (`forceLocale ? Locale : language ||
  navigator.language`); smart-fetch lo manda además en `X-Locale`.

## Opciones: las traduce el GI del core, entera (texto y descripción), según el momento

Las opciones vienen de cualquier lado (un enum, un `ref` de datos, un `ref` de interfaces, las funciones de
`checkLogin`); **quien manda el dato declara la coordenada** en el input (`optionsTranslation`), y el GI traduce
(contrato: el TDD de options de NUI, enmienda 1):

```js
optionsTranslation: {context: "Interface", text: "name-{{value}}", description: "description-{{value}}"}
```

| Pieza | Qué |
|---|---|
| `text` / `description` | PLANTILLAS del subcontext, Mustache sobre la opción, sin escape (`fillTemplate`): `/APP/AAA/User` queda tal cual. Se traduce `option.text` / `option.description` |
| la lista (input, filtro: capacidad `translateOptionsList` en `viewTypes`) | el GI arma `translatedOptions` con `translateOption` en un watch y un microtask (nunca en `created` ni en el render): texto y descripción traducidos, marca `TRANSLATED`, sin lápiz. `optionOf` busca ahí; select, radio y checkbox pintan esa lista; el filtro compara contra lo traducido |
| vista y detalle (sin la capacidad) | no se arma la lista: `renderOptionText` / `renderOptionDescription` traducen solo la opción del valor con `rt` (lápiz según `translatable`) |
| memo | una hoja por coordenada y texto para toda la SPA: el select, los atajos y un `ref` que responde en cada tecla la comparten; no muere con el componente que la pidió |
| llave que falta | la opción que no trae la llave de la plantilla queda cruda (un `name-` vacío sería la misma coordenada para todas) |
| sin `optionsTranslation` | opciones estáticas: `Model-<m>` · `options-<campo>` (texto y descripción, la misma coordenada). Un `ref` de datos: crudo |
| front | `renderOption` del front compone (ícono, descripción) lo que el core entrega resuelto; no traduce |

`interfaceTranslation` (en `core/lib/translation.js`) es la de las interfaces: la declaran `checkLogin` y quien enchufe
un `ref` de interfaces en el menú (`app.menu.optionsTranslation`, junto con su `minMatchingChars`).

### El contrato de una opción

```js
option = {value, text, disabled, icon, description, translation}
translation:
  undefined → como siempre: las coordenadas de quien enchufa (`optionsTranslation`)
  false     → no se traduce nada de la opción (su texto es un dato)
  {text?: {context?, subcontext?, data?}, description?: {context?, subcontext?, data?}}
            → cada texto con lo suyo; lo que no declare sale de `optionsTranslation`
```

- `data` hace del texto una **plantilla** (Mustache, igual que `t(…, {data})`): una sola coordenada en el catálogo y el
  dato crudo adentro. Es por texto y no uno solo, porque una opción armada por código puede necesitar datos distintos
  para el texto y la descripción.
- Una opción cuyo `value` cambia por tecla (la búsqueda de la palette) declara su `context`/`subcontext` fijo, o
  abriría una coordenada por búsqueda.
- La única puerta es `optionTarget(option, spec, field)` (`core/lib/translation.js`): la lista (`translateOption` →
  `t()`) y la vista (`renderOptionField` → `rt()`) preguntan ahí.
- El nombre hace par con `optionsTranslation` (lo que declara el input). No confundir con `translatable: false` del
  campo, que es "se ve traducido pero sin lápiz".

## Placeholder

Nace en el **back**: `toInput` pone el del campo, si no el del type, si no el genérico por type del deploy
(`genericPlaceholder`), si no `"Enter data"`. En el front lo consume UN solo punto, `GenericInput.declarePlaceholders`
(`lib/GenericInput.jsx`), que declara las coordenadas con `t()` y elige rama (`own`/`doubleCheckOwn`). Ningún otro
componente construye ni pisa el placeholder; envolverlo con `t()` en otro lado duplica la traducción.

## Un form del framework suelto

Para montar un form con definición de inputs a mano dentro de un componente propio (no como input de otro form):
`ItdForm` con `form={[...inputs]}`, `modelValue`, `onUpdate:modelValue`, `buttons` y `onSubmit({errors, value})`,
con `model` forzado si el componente puede abrirse dentro de cualquier admin. Caso vivo:
`ItdTranslationEditor` del plugin `translate`; el patrón original, la vista `Upload`. En modo `form`
lo que se muestra sale del prop (`externalValue`); `formBus.getValue` lee el contenedor interno. La definición se
construye UNA vez (`data()`): si cambia de identidad, el watcher del GF reconstruye `localForm` y pisa lo que el
controller puso.

## Cómo se prueba desde un spec

- **El lápiz del editor es HERMANO del nodo**, no hijo: `page.locator("#tt-paragraph + [data-test='itd-t-edit']")`.
  Una marca puesta a mano muere en el repintado que trae la traducción.
- **Un `attrs: {"data-test": …}` en un input del form queda en el wrapper Y en el control**: el selector va con el
  tag, `input[data-test='itd-t-locale']` / `textarea[data-test='itd-t-input']`, o resuelve a dos elementos.
- El texto se lee del `.itd-t-html` (innerHTML siempre); el `status` no está en el DOM, se infiere del borde en modo
  traducción (`getComputedStyle(el.parentElement).borderTopStyle`).
- Árbol de specs: el `playwright.config.js` del plugin `translate` (un worker, proyectos `setup` → `anonymous` /
  `authenticated`; el login se hace una vez en `auth.setup.js` y viaja por `storageState`). Una pestaña que
  aterriza directo en una ruta no recibe redefiniciones en vivo: `boot(page)` de `lab.js` arranca la app en `/`.
