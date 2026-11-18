# At the end of the day: review the skills with the skills skill

Executed by `cierre diario`, over all the skills, at every close.

1. **Weigh ALL the `SKILL.md` files** (`~/.claude/skills/*/SKILL.md` and `<marketplace repo>/plugins/*/skills/*/SKILL.md`): a `wc -c`, no prior filter.
2. **Those that exceed 20 KB or 300 lines go through `skill-creator`** (`superpowers:writing-skills` as a complement).

The threshold applies only to the `SKILL.md`; the `references/` do not count. Third-party skills (`graphify`, `diagram-design`, those of `~/.agents`) are weighed but not touched.

## How one is reorganized
1. If it has uncommitted changes or is not under git: it is not touched, it is noted in the queue.
2. It is analyzed in full: `SKILL.md` and all its `references/`.
3. Green/red tests BEFORE: questions it must answer and cases it must divert to another skill; a fresh subagent loads the skill and answers.
4. It is reorganized: contract in the `SKILL.md`, history and cases to `references/`, without removing contract.
5. The tests are repeated and iterated until they pass, looking at the FW code to know what is correct. With everything green, it is committed. If the code does not do what the skill promises, it is a finding (`skills-first-and-close-gaps`).

## What it reviews
- Size and form: the `SKILL.md` is the short contract, in tables, with pointers.
- The description: that it triggers on what the skill covers today.
- Duplicates and contradictions among the `SKILL.md`, its `references/` and sibling skills.

If a `SKILL.md` grew, some history crept in: it goes to `references/`. Contract is not trimmed to meet the size.
