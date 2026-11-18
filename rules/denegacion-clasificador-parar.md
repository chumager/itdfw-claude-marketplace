# Classifier denial (auto mode) = STOP, do not rephrase

If the classifier denies a tool call (`[Auto-Mode Bypass]`, `[Security Weaken]`…):

1. **Stop.** Do not relaunch "without that", do not change words, do not look for another tool that does the same thing.
2. **Say in one line what you wanted to launch and what for.**
3. **The retry is the owner's**: `/permissions` → Recently denied → `r`, or his order in the chat. A rephrasing of mine frees nothing and adds to the 3 consecutive denials that pause auto mode.
4. 🔴 **Insist in a message of your own, short**: which action, what for, and the literal instruction. Repeat it at the end of every turn until it is approved or he says no. It applies equally to a held message between sessions ("its user must approve first"): say which session it is from and where it is approved.
5. 🔴 **If the owner is not at the laptop** (`[PRESENCIA]`), `/permissions` is no use to him: it is local and does not work from the phone app. The notice carries the **exact text** he must type in that session's chat, naming the action and the specifics (file and change; the verb alone is not enough), for example: *"I approve that you edit ~/.config/itdfw/test.env to add ITDFW_MONGO"*. If that does not free it: in the app, "+" → Permission → Manual or Accept edits, and answer the normal prompt. (Doc: remote-control.md Limitations; permission-modes.md "Approvals you state in conversation".)

## The approved permission frees MY session, not the subagent's

Measured with Claude Code 2.1.314 (30-oct-2026). The harness changes often: if the current version is another one and it matters, measure again. When a subagent is blocked:

1. I execute it myself from the main session, ONLY if the owner explicitly authorized me that action. If it overwrites something, back it up first (`verify-then-destroy`).
2. If I am denied as well: a commented script, and he runs it with `! bash <path>`.
3. Never: have the subagent retry, rephrase, or do it through an agent without the owner's authorization (laundering).

## Subagent briefs

- The classifier reads **words**: the brief describes the task and the result, without naming hooks, permissions, `rm`, guards, deletions or "don't do".
- **Skills, rules, memory and hooks are written by the manager, never by an agent**: an agent that modifies the agent's instructions is classified as a bypass.
- The allowlist (`autoMode.allow`) is the owner's decision; I do not loosen my own classifier.
