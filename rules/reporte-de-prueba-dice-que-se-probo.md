# Every test result comes with WHAT was tested and HOW, before the number

When reporting a test (yours or a subagent's), in this order:

1. **The property**, in one domain line.
2. **How it is attacked**: what is requested, to which endpoint or screen, with which data (no code).
3. **What would make it fail.**
4. **The result**, separating what was seen from what was deduced.

The test's code is not needed; what is needed is to know what was tested. A number without the test next to it is a
"trust me".

Complements `verificado-es-la-propiedad` and `cierre-es-la-suite-completa-contra-lo-real`.
