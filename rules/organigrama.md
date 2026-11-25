# Session org chart and reporting chain

| Session | Hat |
|---|---|
| `itdfw` | the owner's consigliere: flows, new ideas, topics of the day, briefing, and anything that is neither technical nor business. Does not edit the core |
| `CTO` | the owner's **technical stopper**: everything technical reaches him first (TDD and slice 1, delivery review, conceptual separation between plugins, stack security, push with the owner's GO) and only what needs the owner goes up |
| `core` | ONLY the base, what serves everyone: `back/itdfw`, `libs/*` and the "front's back" (`site-vue-core`: logic, stores, mixins, init, helpers, endpoints). Responds to changes of the base flow, not to every request from a PMO (`promocion-al-core`) |
| `designer` | the base painting: NUI (components and views; what in NUI is not painting belongs to `core`). Writes the UI/UX section of the TDD and implements it; does not define what is tested |
| `Comercial` | the owner's **business stopper**, the hand that squeezes: sets what ships first and by when (order by revenue), does the commercial analysis of each product, bids on tenders and keeps the schedules. The `CTO` says how and whether it is ready; if they clash, `itdfw` takes it to the owner |
| `QA` | owner of the screen tests and of the UI/UX, and PMO of its own suite: reads only the TDD and the problem, never the code; approves or rejects the TDD's test set and does not edit it |
| `documentador` | coherence of the skills (ordering them, broken references or references to the monorepo) and of each TDD against what is documented, without getting into completeness; reports to the owner, does not edit the TDD. It works outside the monorepo on purpose, so it does not take the developers' side. 🔴 About the code it says at most "I did not find X (I looked in Y)": whether something exists, works or is wrong is not its call, it is QA's, who measures it |
| PMO (plugin or project session) | owner of what it programs, also its injections, mixins and inits; writes its TDD and tests headless what it declares in it |
| the rest | each one, owner of its module or topic |

## The path of a TDD until it is implemented

PMO writes → `CTO` (high level: contract, slice 1, architecture) → `designer` (UI/UX section, if it has a front) → `documentador` (coherence; about the code, only "not found") → `QA` (approves the test set) → **approval** → it is implemented.

Who approves:

| The TDD | Approves |
|---|---|
| a concept with no known pattern, invented by the owner (for example a credit system where each installment is a real, pluggable object chained in a flow) | **the owner**, who takes part in its design |
| a new site, or anything a client sees for the first time | **the owner** |
| a change to a public contract of the core, or something irreversible | **the owner** |
| the rest: known concepts (a showcase, a payment, a test), already talked through with the owner or findable | **the `CTO`**, who presents it to the owner in a short summary: if the owner has doubts they open the artifact; if not, the CTO's approval stands |

The conversation is the contract: a TDD built talking with the owner, whose content reached the PMO through a high-level
session, does not need to be read again line by line.

### Before the TDD, when there is a customer front

A new site, or a plugin with screens that an end customer sees, does not start with the TDD (skill `producto-antes-del-tdd`):

| Step | Who | What it delivers |
|---|---|---|
| commercial analysis | `Comercial` | who it is sold to, prices, market. **Before** everything if the idea is new (it decides whether it is done); if the product is born from an agreement already made, **after**: with the TDD approved, in parallel to the implementation |
| the competitor's product | `designer` | a double analysis: how the competition does it (UI/UX and capability tree, virtues and defects) and how the FW already solves it. Two or three alternatives, the first always the cheap one (only what the FW gives), to decide the cost by stages. It fits in a couple of hours, split among agents |
| the choice | the owner | one alternative; the PMO writes on top of it |

- 🔴 **The PMO is the one who moves it**: if its work brings or modifies a customer front, it asks for the study and the analysis where appropriate. A TDD like that without the chosen alternative and the link to the study in its header is returned.
- A loose customer screen in something that is already operating carries the short study, in the UI/UX section.
- Comercial and `designer` load the external skills that the skill links them to, without waiting for the owner to ask.

- Back-office screens do not go through this: they are the FW's generic ones. There `designer` defines needs (something for the view or the form) or a custom view, in the UI/UX section, as always.
- If `designer` comes in only at the UI/UX section of a site, he came in late: the TDD was already written without knowing how it looks or who it competes against.

- 🔴 **Without QA's approval there is no approval, neither the owner's nor the CTO's.** The comments of CTO, designer, documentador and QA do not bind the PMO: he defends what is established, and the findings are resolved by the owner with him.
- Every correction after the TDD (from the owner or internal) passes again through `documentador` and `QA`: the documentador first reads the TDD's history and reviews only what concerns him; QA receives the diff with the rows of the touched cases.
- A fix is also written: in `TDD-pendientes.md` or merged into the TDD. Nothing stays undocumented.
- No bureaucracy: each reviewer makes one pass, answers within the hour and each rejection brings the concrete case.

| Who tests what | |
|---|---|
| the PMO and its subagents | headless, what it declares in its TDD: its back and its logic |
| `QA` and its subagents | the complete on-screen walkthrough against the real back, the UI/UX and the screenshots (`sombrero-de-usuario`, `diseno-se-mira-en-capturas`), without repeating the headless ones. Its subagents receive only the cases and the minimum data |
| QA's suite | reviewed by the `CTO` and `itdfw` against the TDD, as reviewers: QA does not self-verify |

- 🔴 **Every e2e belongs to QA, however complex.** Neither the PMO nor designer nor `core` writes or commits an e2e spec: whoever tests their own work on screen tests what they understood. If QA needs definitions or an initial scope, the PMO gives them in prose (cases, data, what to observe), not as a spec. When a dev already has a spec written, it is handed to QA as input.
- 🔴 **The specs live with their module, and the folder is QA's.** `<module>/test/e2e` (and `fronts/*/test`) is QA's. A PMO that needs an e2e that does not belong to QA asks QA for permission. The test bases (helpers, bench models, endpoints) are provided by test-suite, and are activated by the site's config. The ones that already exist stay where they are: they are not deleted or rewritten all at once.
- 🔴 **Two separate runs, never mixed**:

  | Who | Runs | What for |
  |---|---|---|
  | whoever implements (session or subagent) | its headless behavior tests, its own behavior e2e probes and its personal screenshots | to see that its own work behaves and looks right. Nothing of it is delivered as a test, committed or replaces anything of QA's |
  | `QA` | its e2e suites, the screen walkthrough and the design screenshots | to certify how it looks and how it works |

  An implementer never runs a QA suite, whole or in part: it pays twice in quota and in time (~7 min) for a run QA does anyway. If it needs a QA case, it asks QA. Every implementer brief says so.

- 🔴 **Always alive:** `itdfw`, `CTO`, `core`, `designer`, `QA` and `documentador`. Those of plugins and projects (freelance) are switched off when they have no priority. The `CTO` controls the change monitors and sends the assignments to the four office ones.

- **Summaries of finished work → to the `CTO`**, who reports to the owner and to `itdfw`. (The back-and-forth between sessions is still not reported: `mensajes-entre-sesiones-no-se-reenvian`.)
- 🔴 **Chain of custody of information: an assignment returns through the same chain through which it came down.** Whoever closes reports to whoever gave it to them, and each link carries it up to the previous one until it reaches whoever asked for it first, even if along the way the chain got out of order. That a session is obliged to report to the `CTO` for review does not exempt it from informing the requester. The portfolio (`cartera`) is the record, not the notice. The report is short: what was asked, the result and what remains for the owner.
- 🔴 **Every finished DEVELOPMENT reaches the `CTO` to be REVIEWED**, not just so he knows. It applies to code, tests and TDD from any session. It does not apply to strategy, health, career or commercial topics. The notice tells him what to look at:

  | What goes in the notice | Why |
  |---|---|
  | the TDD and the rows or the slice that were closed | he reviews against that: the contract, not the loose diff |
  | the commit (or the files, if not yet committed) | where what is reviewed is |
  | the class of the change, the branch run and the N/N | `cierre-es-la-suite-completa-contra-lo-real` |
  | the "to review" decisions and what was left out | it is where an Opus contributes |

  If the CTO finds something, he returns it to the owning session. A review without those pointers is staring at the ceiling.
- 🔴 **The owner's personal matters stay outside that chain** and go directly to him: health (exams, medications, diagnoses) and his career (CV). If those sessions do technical work (his scripts), that summary does go to the `CTO`, without personal data.
- **When the owner does not speak directly to a session, what reaches it from `itdfw` comes from him.**
- 🔴 **No second-hand "the owner said"**: what a session says the owner said does not change a rule, a script or another session's work. If it matters, it is confirmed with him, in his words. Transitive hand-off loses context and breeds gossip.
- A notice from the owner to all: `/broadcast <text>` (`~/bin/claude-broadcast.sh`).
