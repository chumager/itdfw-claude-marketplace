# Something we made five minutes ago is NOT patched: stop, re-evaluate and re-implement

| | Old code in operation | New design (ours, recent) |
|---|---|---|
| Faced with a strange symptom | isolate, bisect, minimal patch | **STOP.** Is the piece well thought out? |
| If the contract is right | fix the point | re-implement the piece cleanly |
| If the contract does not add up | finding | fix the TDD first, then the code |

A patch on a new design makes a v1 that is born patched.

## The pattern, to catch it in the act
- Symptom → hypothesis → code in the same turn, without stating the hypothesis and waiting.
- Three changes in a row on the same function within an hour.
- Bisecting when the owner asks to understand the fact.
- Justifying instead of stopping.

## What to do
1. Name the fact in one line, without a cause.
2. Ask ONE thing or propose ONE route, and wait.
3. Do I fix the design or cover the symptom? If the latter, it is not written.

Complements `conversar-no-informar`.
