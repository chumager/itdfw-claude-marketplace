# graphify FIRST when I do not know the monorepo — and search by EXACT TERM

Faced with "where does X live?", "who uses Z?", "how does A connect to B?", the graph goes before grep, before reading files or launching subagents to explore. It applies to me and to every agent.

## Order
1. **`mcp__itdfw-graph__find "<technical terms>"`**: semantic; the only one that answers when you do not know what the piece is called. Terms, not prose; it accepts synonyms in English and Spanish.
2. **`graphify query "<exact term>"` / `path` / `explain`**: lexical + BFS over `graph.json`, when you already have the name and want neighbors, imports or community.
3. **MCP `inventory`** if it is a front-end component: exact chain and regression (for "who uses X?" the inventory wins).
4. **Serena** → **Read**.
5. grep only for plain text.

## 🔴 `graphify query`: exact term, never a sentence
```bash
graphify query "mutex"              # ✅ all relevant
graphify path "Mutex" "PubSub"      # ✅ the real import chain
graphify query "mutex: cómo funciona el sistema de locks y quién lo usa"   # ❌ garbage ("mutex: how the lock system works and who uses it")
```
graphify has no embeddings: the match is lexical and every word of the sentence is a BFS seed node. It is not a RAG: it gives verifiable structure (imports, paths, communities).

## Red flag
A question in the `query`, or a subagent exploring something the graph already knows → STOP.
