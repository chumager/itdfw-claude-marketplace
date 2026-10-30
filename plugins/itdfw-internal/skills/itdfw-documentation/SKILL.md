---
name: itdfw-documentation
description: Use when creating, moving, or organizing documentation in the ITDFW monorepo. Triggers when documenting a completed feature, creating a TODO, planning work, or when asked where to put a document.
---

# ITDFW Documentation

## Overview

Documents in `claude-docs/` follow a state machine. A document **travels** through states — it is never duplicated. When reaching architecture, evaluate whether to update an existing skill or create a new one.

## State Machine

```
roadmap.md (ref) → TODOs/ → current/ → architecture/ → skill evaluation
```

| State | Meaning | When to use |
|-------|---------|-------------|
| **roadmap.md** | Abstract future vision, high-level items | Ideas not yet broken into tasks |
| **TODOs/** | Pending work, NOT started | Concrete tasks with design/steps |
| **current/** | Actively being worked on NOW | Moved from TODOs when work begins |
| **architecture/** | Implemented, documented **and OPERATING** | Moved from current only when the TDD's "Puesta en operación" has its four fields (commit, version, deploy, real use) — tested alone is not enough (skill `tdd-narrativo` §6) |
| **operations/** | Operational guides (install, deploy, troubleshoot) | How-to-run, not how-it-works |
| **projects/** | Business/project documents | Belat, presentations, strategy |

## After reaching architecture/

When a document lands in `architecture/`, evaluate:

1. Does a related skill exist in `~/.claude/skills/itdfw-*`?
   - **Yes** → complement the existing skill with the new knowledge
   - **No** → evaluate if a new skill is warranted (reusable technique? or one-off?)
2. Update `roadmap.md` with completion date

## TODOs/ Structure

```
TODOs/
├── migration/          ← migrating existing things (DDD, front→core, Vue2→3)
│   └── {topic}/
├── features/           ← new things that don't exist yet
│   ├── components/
│   ├── backend/
│   ├── plugins/
│   ├── security/
│   └── infra/
├── fixes/              ← bugs
└── ideas/              ← exploratory, not committed
```

**The document keeps its path when moving between states:**
`TODOs/migration/DDD/currency.md` → `current/migration/DDD/currency.md` → `architecture/DDD/currency.md`

## Quick Reference

| Action | Where |
|--------|-------|
| New TODO | `claude-docs/TODOs/{type}/{topic}.md` |
| Start working | Move to `claude-docs/current/` (same subpath) |
| Finished + tested + **operating** (commit, version, deploy, real use) | Move to `claude-docs/architecture/` + evaluate skill |
| Abstract future idea | Add line to `claude-docs/roadmap.md` |
| Operational guide | `claude-docs/operations/` (install, deploy, templates) |
| Business/project doc | `claude-docs/projects/` |
| Update index | Always update `claude-docs/INDEX.md` after any change |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Put new doc directly in architecture/ | architecture/ = IMPLEMENTED. If not done, it goes to TODOs/ |
| Invent subcarpetas that don't exist | Use the existing structure. If a new category is needed, discuss first |
| Skip skill evaluation after architecture | ALWAYS check if a skill should be created or updated |
| Duplicate doc across states | MOVE, never copy. One document, one location |
| Leave the hallazgo body after documenting it | When a finding in `current/bugs-cross-cutting.md` is closed, **VACIAR el hallazgo COMPLETO**: el cuerpo (puede tener cientos de líneas) se reemplaza por UNA línea — `## Hallazgo #N: <título> — MOVIDO → <ruta destino> (RESUELTO)`. Nunca dejar el cuerpo duplicado pesando en bugs-cross-cutting (que es grande y se carga seguido). El contenido vive en su destino; el hallazgo queda solo como puntero. **Destino según naturaleza del hallazgo**: si dejó un **cambio/definición de arquitectura** → `architecture/`; si fue solo un **error/problema puntual sin cambio arquitectónico** → `history/`. |
| Forget INDEX.md | Always update the index after creating/moving documents |

## File Locations

- **claude-docs/**: `{monorepo}/claude-docs/`
- **INDEX.md**: `{monorepo}/claude-docs/INDEX.md`
- **roadmap.md**: `{monorepo}/claude-docs/roadmap.md`
- **Skills**: `~/.claude/skills/itdfw-*`
- **Legacy docs** (other LLM): `{monorepo}/docs/` — do NOT put new docs here

---

## 🔴 Antes de dar por terminado → `itdfw-completeness`

No declares "listo"/"funciona" sin pasar por la **puerta de salida** del FW: tests **green + red**, **memleak**
si tocaste algo con retención (EE/hooks/globals/cache → `WeakRef`+gc+canario), completitud (*¿qué más toqué que
no probé?*), logs con niveles (front `$log`/`$logDebug`, back `Log.XXX`+`logLevel`), y validación **externa** (el
"Done" no se da sobre tu propio testing). Es un **servicio**, no un browser → cero memleaks. Skill **`itdfw-completeness`**.
