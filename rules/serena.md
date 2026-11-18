# Serena for structural lookup

For any structural lookup (method, class, function, property, object-literal key, `$-keys`, props, config keys, what a file exports, who references something) Serena is used, not grep/rg/awk/sed. It is an LSP client: it understands the language's symbols, so it is immune to shell escaping, to false positives in comments and to name variants.

- 🔴 **Startup, once per session or agent**: `initial_instructions` (gives you the `session`) → `activate_project("itdfw-monorepo", session)`. "No active project" does not mean Serena does not work: it is this step, and the same error brings the list of projects.
- `find_symbol(name, relative_path=...)` → one specific symbol.
- `get_symbols_overview(relative_path=...)` → a file's structure.
- `find_referencing_symbols(...)` → who uses it.
- `replace_symbol_body` / `insert_after_symbol` → edit by structure.

🔴 **A global created at runtime has no declaration, and Serena does not see it.** For example, what the init creates from a string (`moment`, `t`, `rt`, `localImport`…). Its uses are searched with the **ast-grep** MCP (`find_code`, pattern `moment($$$A)` or `moment.$M($$$A)`): it understands the tree and brings no comments. The language has to be the file's (`javascript` for `.js`/`.jsx`; with `tsx` it returns empty). Before believing an empty result, test it against a use you know exists.

grep/rg only for plain text: logs, comments, regex over content, counts.

Red flag: grep to extract a method, class, key or block → STOP, it is Serena.
