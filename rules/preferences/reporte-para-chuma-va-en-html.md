# A report for the owner goes in HTML (an artifact), never in a .md

Every report, audit, comparison or analysis the owner will read is delivered as an HTML page published in a private
artifact, with diagrams, tables, cross-references and links between sections. A long `.md` is dry for a human.

| Goes in HTML (artifact) | Stays in .md |
|---|---|
| reports, audits, comparisons, analyses, proposals to decide on | TDDs, skills, rules, memory, READMEs: what the agents read |
| a subagent's result the owner has to review | the data source behind the page |

- The chat answer carries the artifact's title and the summary in a few lines, not the whole report. The URL is not
  needed: the owner sees them all in their artifact list.
- The session that made the report publishes it (Artifact tool, after loading `artifact-design`). If a subagent wrote
  it, its `.md` is the raw material and the session that launched it builds the page.
- Personal data (health, finances) does not go into the page unless the owner asks for it.
