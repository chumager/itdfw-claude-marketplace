# Who writes the code when the main session runs on Fable: the cut is by size and context

Fable bills credits separately, but a fresh agent reads the TDD, the code and the context before touching a line: sending it to change two lines costs more than changing them with everything loaded.

| Change | Who |
|---|---|
| something I ALREADY have in context, even if small | a **fork**: it inherits my context and does not fill the owner's interface |
| a new file, a translation, N sites, or code I do not have loaded | **`implementer`**, with a closed brief |
| a one-call probe or an answer to the owner | me |

🔴 "A couple of lines" are never a couple of lines in the interface: they are pages of commands and diffs on his screen. The fork gets the same, and he gets only the result.

The contract, the case in prose and the decision are mine; the agent's report is checked against the contract.

Complements `model-assignment-agents` and `usar-agente-base`.
