# The `itdfw` plugin — 20 skills for developing on ITDFW

A skill is a Markdown file (`SKILL.md`, sometimes with a `references/` folder) that Claude Code loads when its
description matches what the agent is about to do. Each skill here holds the contract of one area of the **ITDFW**
framework, so that an agent that does not know the framework does not re-invent what exists or break its conventions.

The framework's code is not in this repository. The skills describe it, with file names and behaviours taken from the
framework's source. **They only make sense next to that code.**

## The skills

| Skill | Area it covers |
|---|---|
| `itdfw-models` | Back-end business models (`mongooseSchema` files): where they live, how the schema function works, fields and model options |
| `itdfw-db-models` | Models defined in the database instead of in files (guided form or raw code), and how they compile |
| `itdfw-mongoose-types` | Custom Mongoose types, type defaults and the `toInput` pipeline that turns a schema into form inputs |
| `itdfw-ddd-value-objects` | Types whose value has behaviour of its own (formatting, arithmetic, derived getters) as a shared domain class |
| `itdfw-api-system` | Back-end endpoints: the `APP/` folder, `schema.options.<verb>`, how a route is resolved, authentication and permissions |
| `itdfw-plugins` | Mongoose plugins: the three application modes and how they extend or override a model |
| `itdfw-fwplugin` | The FWPlugin: one distributable unit that bundles models, types, endpoints and its own front end |
| `itdfw-deploy-config` | Deploy configuration: sites, databases, which plugins load, which file the process starts with |
| `itdfw-core-init` | The front-end bootstrap: the pack proxy, the `init.js` cascade and module loading |
| `itdfw-front-app` | The site/app layer of the front end: wiring a site to a front library and the cascade that overrides components |
| `itdfw-front-develop` | Working inside a front end: components, the render pipeline, value and validation pipelines |
| `itdfw-front-creation` | Creating a new front library that wraps a UI framework so the core can cascade through it |
| `itdfw-nui` | Components that render Naive UI: tags, colours and theme tokens |
| `itdfw-translate` | Making a site's texts translatable and redefinable by the site owner |
| `itdfw-currency` | Money amounts and own units (tickets, points): the `Currency` type, the document's currency and the site's currency Config |
| `itdfw-design` | The design judgement over a screen: which FW piece each element is, scale analysed on its merit, every state, and reviewing an implementer's screens |
| `itdfw-migration` | Migrating an existing system into ITDFW, and renaming fields of models already running |
| `itdfw-completeness` | The framework's definition of done: what to check before saying a task is finished |
| `tdd-narrativo` | How to write, read and implement a `TDD.md`: a narrative contract approved before code, split into slices |
| `producto-antes-del-tdd` | A customer-facing site or screen starts with a study of the competitor's product and a chosen alternative, before its `TDD.md` |

## How the work is specified and checked

- **`tdd-narrativo`** defines the document that precedes an implementation: a narrative of what the module must do, the
  scope, the model with its endpoints, the slice that is built first, and a table of test cases. The pieces published
  next to this plugin (`agent-tools/`) each carry a `TDD.md` of that kind.
- **`itdfw-completeness`** lists what must be true before work is called done, including how a test report must say
  what was and what was not exercised.

## How to verify them

**There is no automated check that a skill's text still matches the framework's code.** They are maintained by
comparing the claims with the source by hand, and a claim that the code contradicts is corrected in the skill or
reported to the code's owner. When a skill and the code disagree, the code is right.

## Language and size

The descriptions in the front matter are in English; the bodies mix English and Spanish, because they were written for
an agent that works in both. The plugin holds about 1.1 MB of text in 17 skills; `itdfw-front-develop` is the largest
(35 files).

## Installing

See the repository's root README. The plugin has no `version` on purpose: it tracks commits.
