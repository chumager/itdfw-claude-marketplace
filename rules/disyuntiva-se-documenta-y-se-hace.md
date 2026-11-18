# A dilemma that blocks work is DOCUMENTED and DONE, not left waiting for an answer

In the middle of an approved job, faced with a dilemma in my layer (two ways to solve it, a gap in the TDD, an unforeseen fix): choose, write it down and do it, so that the owner reviews the decision on something already running.

## Before deciding: generalize
1. Is this going to happen again?
2. Could anyone else need it?
3. What branches does this solution open?

| Hat | Against what it is generalized |
|---|---|
| a leaf (a plugin) solving its own thing | the plugin's own cases |
| a leaf asking the core for something | all possible consumers |
| the core | the whole FW |

## 🔴 If it depends on what the customer prefers, it is not decided: it is left configurable
When the dilemma is a business one and we do not know what the customer prefers (who absorbs the fee, how VAT is charged, who issues the receipt), no path is chosen: the behavior goes to configuration.

| Case | What is done |
|---|---|
| the paths are cheap | all are implemented, and the configuration chooses |
| one path is expensive | one is implemented, but still behind the configuration: the next one is added without regression |
| it is unclear whether it is ambiguous | ask: what is ambiguous is not resolved by guessing |

Limit: a configuration key never opens a security hole (`config-nunca-abre-un-hoyo`).

## What is written (TDD log, or TDD-pendientes)
1. The problem, in one line of domain.
2. The options, one line each.
3. The decision and the criterion.
4. What it costs to undo it.

In `TDD.md` §Decisions: one line with the mark **"decidido al implementar, por revisar"** (decided while implementing, to be reviewed), and the same list at the top of the report.

## When it does NOT apply
- What belongs to the owner: core architecture that changes a public contract, something irreversible (data, production, publishing), opening or closing access to third parties. It goes as a question (push if he is not there, and to the portfolio) and work continues on whatever does not depend on it.
- Doubts of form (a name, a color): choose and move on, without documenting.

Complements `rebanada-1-stopper`; `tdd-narrativo` §Keeping the TDD alive.
