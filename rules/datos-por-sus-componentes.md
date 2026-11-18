# GOLDEN RULE: a data value goes through its component's logic; the painting is free

Every value with a type (amount, date, duration, percentage, phone, RUT, HTML, file…) is displayed and edited with a component that **extends the core's business-logic base** for that type. The painting is free (any layer may override the component; the cascade decides). What is forbidden is processing the data outside that base.

In a custom view: `renderGI` in `detail` mode with the component of its type (skill `itdfw-front-develop`), or a custom component that extends the same base.

| Base | What is lost by skipping it |
|---|---|
| `ItdHtml` | the sanitizing (DOMPurify): XSS |
| `ItdCurrency` | the document's or field's currency and the visitor's locale, reactively |
| those with a VO (value object) | mask, essence validation, locale formatting, XLS and PDF |

A custom processing silently breaks what the base was listening to (language, currency, sanitizing), and the platform ends up answering for a promise it did not keep.

## Red flag
`Intl.`, `toLocaleString`, `toFixed` for money, `innerHTML`/`v-html`, or the text of a typed value assembled by hand → STOP. *Which core base has the logic of this type?*

Complements `fw-ya-lo-provee`.
