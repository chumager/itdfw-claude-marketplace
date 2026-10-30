# Pack — the four operations

## Structure

```
pack = [
  [block0Item0, block0Item1, ...],  // Block 0 — parallel inside
  [block1Item0, ...],               // Block 1 — runs after block 0
]
```

Blocks are plain arrays. One Proxy on the root adds four operations **by name** (the `name` of an item object; a plain
function's own `.name` does not count):

| Operation | Does | Name missing |
|---|---|---|
| `pack.search(X)` | the block holding X (a plain array: `push` on it adds in parallel with X) | `null` |
| `pack.before(X, [items])` / `pack.after(X, [items])` | a new block right before / after the block of X; returns it | throws |
| `pack.replace(X, obj)` | `obj` in X's place (same block, same position); returns `obj` | throws |
| `pack.delete(X)` | takes X out of its block; returns it | throws |
| `pack.push(block)` and the rest of the array | native | — |

There is no navigation (`prev`/`next`/`parent`/`root`, `searchObj`, item-level `after`): whoever needs finer control
uses the array as an array.

## 🔴 A name is declared ONCE

`applyPack` checks it first: a name repeated anywhere in the pack throws (`pack: "X" is declared twice`) and the site
does not load. To change something another layer declared:

| Want | Do |
|---|---|
| another implementation of X | `pack.replace("X", {name: "X", func() {…}})` — it runs where X ran |
| wrap / adjust X | a new block **after** X (or before whoever uses it) that reads `this.X`, changes it and writes it back; the sequence guarantees `this.X` exists |
| X gone | `pack.delete("X")` |

```js
// register a loader as soon as addLoader exists: a block right after the one that declares it
pack.after("addLoader", [function () { this.addLoader("$myOption", (component, value) => { /* … */ }); }]);
// wrap something another layer declared (X declared in an earlier block): read this.X, write it back
pack.after("X", [function () { this.X = wrap(this.X); }]);
```

Two layers wrapping before the same name keep the cascade order (each `before` lands right next to X).

## Life

The pack lives only inside the core module and is handed to each `init.js` (`fn(pack)`); it is not global. Nothing is
locked after `applyPack`: keeping a reference and changing it later is out of the architecture.

Contract and tests: `libs/itdfw-site-vue-core/TDD-pack.md`, `tests/pack.test.js`.
