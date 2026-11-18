# A business ambiguity is not decided: it is asked about and left configurable

When a TDD or a design reaches something where we do not know how the customer wants it (who absorbs a fee, how VAT is charged, who issues the receipt), one option is not picked for them.

1. **Ask**, marking it as ambiguous: it is ambiguous because the data is missing, not because judgment is missing.
2. **Design it as configuration**: the possible paths are named, and which one applies is chosen without touching code.
3. **If it is expensive**, implement a single path, but still behind the configuration. The next one comes in later with zero regression.

- In ITDFW, "configuration" is usually a field of the model that the owner edits (the event, the site), not a key of the deploy config.
- If one of the options opens a security hole, it is not configurable (`config-nunca-abre-un-hoyo`).
- What is not ambiguous gets decided (`disyuntiva-se-documenta-y-se-hace`): this is only for the customer's preference.
