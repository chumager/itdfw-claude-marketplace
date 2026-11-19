# A business ambiguity is not decided: it is asked about and left configurable

When a TDD or a design reaches something where we do not know how the customer wants it (who absorbs a fee, how VAT is charged, who issues the receipt), one option is not picked for them.

1. **Ask**, marking it as ambiguous: it is ambiguous because the data is missing, not because judgment is missing.
2. **Design it as configuration**: the possible paths are named, and which one applies is chosen without touching code.
3. **If it is expensive**, implement a single path, but still behind the configuration. The next one comes in later with zero regression.

- In ITDFW, "configuration" is usually a field of the model that the owner edits (the event, the site), not a key of the deploy config.
- 🔴 **A catalog the business can grow is data, never fixed in code**: currencies, bottle sizes, product types. An enum in the schema or a value hard-wired in a field (a price field forced to `CLP` when the currencies come from the Config) turns a new value into a release. It goes to the runtime Config (skill `itdfw-deploy-config`, level 2) or to a model. An enum stays only for states where the code decides which way to go. Litmus: *if a new value shows up, do we have to release?*
- If one of the options opens a security hole, it is not configurable (`config-nunca-abre-un-hoyo`).
- What is not ambiguous gets decided (`disyuntiva-se-documenta-y-se-hace`): this is only for the customer's preference.
