# Closing means the COMPLETE SUITE against the REAL thing, never "the last case passed"

Before saying "green", "closed" or "you can test": the entire suite of the branch that the change touches, against the real system.

**The prior**: about 60 % of an implementation is fighting foreign software that does not behave as it says. No foreign layer is right until it is measured against the real thing, on its latest version.

## 1. The BRANCH that the change touches is run, in full

| Class (declared in the commit) | How it is recognized | Branch that is run |
|---|---|---|
| **harmless incremental** | new capability behind an option (opt-in: nobody goes through it until they switch it on) | the suites of the touched piece, with their new cases. Nothing else: no full set, no other modules' suites |
| **behavior change** | code that someone already goes through (layout, inherited method, default, hook) | the module's suite and that of everything that inherits or calls it (core → NUI → plugins with a front) |
| **breaking change** | a signature, name or contract that someone uses | all of them, and a notice to the sessions that own the consumers |

🔴 The hard part is tracing the branch. Five questions, each answered with `rg`, the graph or `inventory affected`:
1. Is it incremental or does it change a definition?
2. Who uses it?
3. How do they use it (which part of what changed do they touch)?
4. On which scopes does it operate?
5. What changes in the observable behavior? That is what gets verified.

Without evidence to answer them, the change moves up a class.

## 2. The real back is tested, not a double

A test server of your own is good for level 0, but it certifies nothing that depends on the real server (Express, nginx, the browser): a 304, a header, a cache mode. That property has its case against the real deploy.

## When

While working, each change runs only the cases that prove it. The complete suite runs once, at delivery.

## Red flag

- Reporting "green" with `-g "Q15"`, with the local harness, or "you can test" without the branch's N/N → STOP. The report carries the class, the branch (and what it was traced with) and the N/N.
- The other extreme: running everything by reflex is not having traced the branch.

Complements `verificado-es-la-propiedad` and `itdfw-completeness`.
