# Back-End Type Defaults (z99base.js)

Each Mongoose type defines defaults applied to all inputs of that type:

```js
Url: {
  forceAttrs: ["baseURL", "protocols"],
  protocols: ["http", "https"],
  _validate: { url: true }
}
```

- `forceAttrs`: attributes that survive transform/omit in toInput.js
- `_validate`: default validation rules (comment out for implicit type validators)

## toInput.js Flow

```
cloneDeep(options) → merge toInputBase/toInputNative/toInput → above??=0, pos??=10000 → validate → forceAttrs → pure (strip functions)
```

- `attrAsFunction`: options, readonly, disabled, hidden can be functions evaluated with req context
- Front receives the assembled object as-is
