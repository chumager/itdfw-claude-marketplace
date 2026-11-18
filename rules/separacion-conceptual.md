# The CTO watches that two plugins do not build the same thing: conceptual separation is his

The FW exists to avoid repeating work. With several PMOs in parallel, the same concept is born twice (the showcase of several of the products; payments). Cutting that off in time is the `CTO`'s job.

| When | What |
|---|---|
| every day | a Haiku pass over the plugins, in pairs, looking for the same concept in two places: models, endpoints, components, flows. If calibration shows that Haiku is not enough, it is moved up to Sonnet |
| when reviewing a TDD or a delivery | the same question: does this already exist, or is it being born in another plugin? |
| a crossing found | `no-juntar-por-parecido` is applied (do they change together?). If yes, the proposal goes to the owner: what is taken out, to which plugin and what it costs |

- Calibration: the already known crossings (the showcase and the payments) are the green case. A pass that does not find them is no good.
- What goes up to the core follows `promocion-al-core`; this is between plugins.
