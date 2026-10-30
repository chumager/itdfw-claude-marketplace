# New Input Component Checklist

1. **Analyze**: What type? What native input? Validation? Composite (Object value)?
2. **Back** (`z99base.js`): Add/check type defaults, forceAttrs, _validate
3. **Core** (`libs/.../components/ItdX.jsx`):
   - `/* global GenericInput */` + `extends: GenericInput`
   - Set `name` (MUST be unique, not "GenericInput")
   - `data()`: type, tag (if non-standard), lazy (if checkbox/radio/form), valueProp, targetValue
   - For composite: `tag: "ItdForm"`, `lazy: false`, extra objects `{}` for extension points
   - Validator: `$validator.addValidator("type", "type", fn)` if needed
   - Methods: initVal, emitter, cast, formatter as needed
   - For composite: override `getInputProps()` with `...this.defaultGetInputProps()` + form props
   - Renders: renderView, renderDetail (core = functional, no visual deps)
4. **Front** (`fronts/.../components/ItdX.jsx`):
   - `import CoreX from "core/components/ItdX.jsx"` + `extends: CoreX`
   - Reset native data if wrapper emits differently (valueProp, targetValue)
   - For composite: override extra objects with BV-specific props
   - Override renders with BV/visual components
   - Use `this.defaultRenderInput()` to wrap (NEVER `CoreX.methods.renderInput.call(this)`)
   - Register BV plugins via `$BVP`
5. **Test**: Add to TestFormPage.jsx, restart vite (new files need restart)
6. **Export cast** if type needs external coercion
