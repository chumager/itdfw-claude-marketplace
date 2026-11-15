# Level 4 — detalle y ejemplo (`mongooseTypes/<Type>.js options.API`)

> Movido sin cambios desde `SKILL.md` (reordenamiento por tamaño). El contrato corto vive en `SKILL.md`; aquí está el detalle, los casos y la historia.

Canonical example: `mongooseTypes/Password.js`:

```js
export default {
  Password: {
    cast(val) { /* ... */ },
    options: {
      component: "Password",
      keepOnEmpty: true,
      forceAttrs: ["minUpper", "minLower", "minNumber", "minSymbols", "minStrength"],
      API: {
        checkStrength: {
          validate: true,
          isAnonymous: true,
          hidden: true,
          defaultMethods: ["GET"],
          GET(req, res) {
            const {password} = req.query;
            const result = zxcvbn(password);
            res.json({score: result.score, feedback: result.feedback});
          }
        }
      }
    }
  }
};
```

URL: `/APP/checkStrength.json` (or whatever path key declared). Independent of any schema — the endpoint exists once for the type, accessible globally. Cualquier form que use type Password puede llamar `checkStrength` desde el front sin que el modelo padre lo redeclare.

Use cases:
- **Validation utilities** intrinsic to the type (Password strength, Email DNS check, URL reachability).
- **Decoding/encoding** services (cipher-decipher of refs, Base64 of File metadata).
- **Type-specific format helpers** (Currency conversion endpoint, Date parsing).

When to choose this over `options.API` of a model: the logic doesn't need a specific Model — it's about the TYPE itself. If 5 schemas use type Password, all 5 need the same `checkStrength` → declare once at type level.
