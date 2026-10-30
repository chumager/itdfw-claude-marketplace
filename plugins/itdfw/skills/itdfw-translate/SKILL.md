---
name: itdfw-translate
description: Use when a text of an ITDFW site has to be translatable or redefinable by the site owner — declaring texts in a component with t()/rt(), choosing the coordinate (model field, component role, error), enabling the translate plugin in a site, giving a user permission to translate (profile function Translation/redefine, or anonymousTranslate for bootstrap), using the in-place editor and the nav toggle, or writing e2e specs that assert translations. NOT for the locale offer/selector (core "Locales") nor for Intl formatting of numbers/dates/durations (that is locale, not translation).
---

# ITDFW Translate — texts belong to the site owner

The developer writes the first version of every visible text; the owner renames it in place. The core ships the
gates (`t`, `rt`, `ItdT`) as mirrors; the plugin `@chumager/itdfw-plugin-translate` makes them live. Contract:
`plugins/translate/TDD.md`. Front detail: `itdfw-front-develop/references/translation-front.md`.

## 1. Enable

```js
// <site>/.itdfw.js
import Translate from "@chumager/itdfw-plugin-translate";
export default {plugins: [Translate]};
```

Without the plugin everything below still compiles and renders the text as written (mirror).

## 2. Declare a text (developer)

| The text… | Write | Where |
|---|---|---|
| has its own node in the DOM | `rt(context, subcontext, text, attrs?)` | in the render. **Preferred**: border, pencil and editor come with it |
| has no node (placeholder, `emptyText`, a store alert, aria) | `this.x = t(context, subcontext, text, {data}?)` | in `created()`; the render reads `this.x.value` |
| is data (a document name, a profile function's description) | nothing | data passes raw, never translated |

🔴 Declare in `created()`, read in the render. A `t()` inside a render or a computed creates one Query per
re-evaluation and the page cycles. `rt()` may sit in the render: `ItdT` declares in its own `created()`.

`text` can be a string, an array (joined with `separator`) or a descriptor `{text, context?, subcontext?, data?,
separator?, onlyTranslated?}`; nesting inherits by `??`. Templates are Mustache over `data`: `{{input.label}}`.

## 3. Choose the coordinate

Reference only: the plugin treats a coordinate as opaque. The norm for model texts is the core's
(`itdfw-front-develop/references/translation-front.md`), which is the source of truth; this table is a copy for convenience.

| Text | `context` / `subcontext` |
|---|---|
| model label · description · placeholder | `Model-<model>` / `field-<x>` · `description-<x>` · `placeholder-<x>` |
| options of a select / checkbox / radio / enum | `Model-<model>` / `options-<x>`; the text is the value (`translatable: false` shows it translated but not editable there) |
| a nested field | `<x>` is the full path: `field-functions.path` (root fields keep their name) |
| component text (empty state, button, title, hint) | `"<Component>"` literal / `<role>` — ONE coordinate, whatever model is around (nobody wants a different "No data" per model) |
| validation / server error | `error` / `<type>` |
| children of a composite input | the parent declares `childrenModel`; passing `model` to the child GI is not enough |

The locale is part of the coordinate: it travels in the query string, one URL per language (`Vary` does not exist
for the FW). The current locale is `store.getters["Config/getLocale"]`.

## 4. Who may translate (owner / admin)

| Who | How |
|---|---|
| a user | holds the function **`Translation/redefine`** in a profile (hidden endpoint, assignable). Granular: a profile with just that function, added as an extra profile |
| anonymous visitor | **never redefines.** With config `Translate.anonymousTranslate` on he only catalogues the texts he sees (site bootstrap); close it afterwards. A redefined `t-href` would send every visitor elsewhere, so the write is profiled, always |
| the MCP | `getTranslatables(model, locale)` / `setTranslations` (plugin `mcp`); it must send `x-locale` to consult another language |

The plugin's config is named **`Translate`** (it was `Traducciones` until 30-sep-2026; every deploy's Config document
was renamed): `anonymousTranslate` (the bootstrap key above) and `cache` `{maxAge, swr}` in seconds, the life of the
resolve endpoint's cache (default `{0, 604800}`). Half of that life is how often a text's `lastSeen` is written: the
date it was last asked for, which tells live coordinates from dead ones and never travels to the client.

The front asks `Translation/redefine.check` once per session; its 40x is the answer (no toggle, no pencils) and shows
in the console like any refused verb. `User.canTranslate` no longer exists.

## 5. Translate (owner)

1. Nav toggle (`ItdTranslateToggle`) → translation mode: every text gets a border by the `status` the back answered:

   | `status` | Border | Means |
   |---|---|---|
   | `pending` | none | still asking |
   | `locale` | `--success-color` (green) | redefined for this exact locale (`es-CL`) |
   | `generic locale` | `--info-color` (blue) | inherited from the bare language (`es`), not this locale's |
   | `generic` | `--warning-color` (amber) | the wildcard `*` answers for every language |
   | `not found` · `not allowed…` · `failed` | `--error-color` (red) | nobody translated it |

   Theme tokens through `n-element`: they follow the site's NUI theme.
2. Pencil next to a text → editor (`ItdTranslationEditor`, an `ItdForm`): context, subcontext, original, status,
   target locale (free text), content type (line / paragraph / HTML), translation, one field per translatable attr.
3. Save → PUT `Translation/redefine.json` → the same Query that painted the text is forced → the page changes at
   once and other listeners refresh through the service worker.
4. The field starts from the exact redefinition of the current locale (empty included) or, without one, from the
   original: a field nobody touched is not saved. To **nullify** a text ("I don't want it, remove it"), empty the
   field and save: the empty redefinition is served as a value and cuts the cascade (no fallback to the generic
   locale or the original). Redefinitions are never deleted; emptying is the way.

## 6. Test it

- Specs live in `plugins/translate/test/e2e`, own `playwright.config.js` (one worker, `channel: "chrome"`,
  projects `setup` → `anonymous` / `authenticated`; login once via `auth.setup.js`, session by `storageState`).
- The pencil is the node's **sibling**: `#id + [data-test='itd-t-edit']`. Form inputs carry `data-test` on wrapper
  AND control: select with the tag (`input[data-test=…]`).
- Console-clean assertions use `isNoise` from `lab.js`: it excludes only the check's 40x.
- A tab landing straight on a route does not get live redefinitions: `boot(page)` starts the app at `/`.
- Back: `tests/back/translatePut.test.js` (PUT, check, 401/403). The bootstrap key (catalogues, never redefines):
  e2e `anonymous-catalog`.

## Red flags

- `t()` in a render/computed → cycles. Declare in `created()`.
- `Model-<m>/…` for a component's own text → N catalogue entries for one text. Use the component literal.
- `$options.name` as context → breaks with `extends`. Literal.
- Reading `userData.canTranslate` → gone. The store getter `translate/canTranslate` reads the check.
- Translating data (a function name, a document's label) → it is data, pass it raw.
- Formatting numbers/dates/durations "with translate" → that is `Intl` + locale, not this plugin.

## References

- `plugins/translate/TDD.md` — the contract (models, endpoints, `ItdT` tree, editor, coordinate norm, test rows)
- `plugins/translate/TDD-bitacora.md` — why each decision (locale in QS, one coordinate, redefine endpoint, Vary)
- `itdfw-front-develop/references/translation-front.md` — front detail and how specs reach the pieces
- `plugins/translate/README.md` — the package face
