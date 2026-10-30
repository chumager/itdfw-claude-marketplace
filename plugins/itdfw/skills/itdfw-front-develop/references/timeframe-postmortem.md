# TimeFrame Postmortem — What Went Wrong

## Context
Level 5 composite (object value, two selects: measure + duration). Final result: ~150 lines core+front. Took 5+ compactations of failed attempts.

## Mistakes in order

1. **Built render from scratch** — resolveComp for selects, manual JSX, ignoring that `tag:"ItdForm"` + GI's renderMainInput handles it
2. **Defined custom ItdForm** — one already existed in the framework
3. **Wrong autovalidation** — used `{type:"TimeFrame", default:...}` instead of `{type:"TimeFrame", type:"TimeFrame"}` (type with its own type triggers autovalidation)
4. **Copied innerValue from .vue** — imitated old TimeFrame.vue pattern without analyzing that GI's validateSelfValue already handles the value lifecycle
5. **Custom render ignoring defaults** — wrote full renderInput without using defaultRenderInput, getInputProps, getRenderProps
6. **Validator scope issues** — couldn't resolve Mustache lambdas because of manual scope instead of using GI's formatM pattern

## Root cause
Not reading GI's defaults before implementing. Every mistake was reimplementing something GI already provided.

## The fix
Read GI's default methods first. The implementation became trivial:
- Core: `tag:"ItdForm"`, `lazy:false`, `getInputProps()` with spread, `form` computed, type validator
- Front: extends core, `{tag: "b-select"}` in extras, wrapper div in renderInput calling `this.defaultRenderInput()`

## Rule
If your component code is getting longer than ~80 lines per layer, you're probably ignoring a GI default.
