# User hat: QA walks through what is SEEN as the average user, before "done"

The hat is `QA`'s, not the implementer's: a dev tests what he understood of the problem. QA is the average user who pokes with his fingers, and what feels off is reported even if nobody asks.

1. **How do I get into and how do I GET OUT of each state?** (drawer, modal, dropdown, form, filter). If it can only be left by "tapping outside", the exit is missing.
2. **Both worlds?** Anonymous and logged in; light and dark.
3. **On the CUSTOMER's phone?** 360 px is the typical Android floor; a narrower folded-phone width (~340) only needs to look reasonably good.
4. **What do I touch with my thumb, and does it fit?** 44 px targets, tappable scrim.
5. **Without network, with empty data, with a long name?**
6. **Do I know what to do without being explained?** A select with `minChars` over a field whose values the user does not know looks pretty and is useless.

- What is walked through comes from the TDD and its UI/UX section (written by `designer`); what is found becomes a case of QA's suite.
- Whoever implements does not certify themselves with this: their own check before delivering is theirs, not a test.

Complements `diseno-se-mira-en-capturas` and the "front component" row of `itdfw-completeness`.
