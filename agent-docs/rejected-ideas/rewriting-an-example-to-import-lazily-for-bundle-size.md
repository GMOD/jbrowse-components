---
name: rewriting-an-example-to-import-lazily-for-bundle-size
description: Rewriting an example to import lazily, for bundle size
area: tooling-tests-and-docs
---

# Rewriting an example to import lazily, for bundle size

backfired.
`LevelSyntenyCanvas` behind `React.lazy` in `SyntenyRibbons.tsx` is sound on
its face (it drags 120 KB of compiled synteny shaders) and *raised* every page:
`synteny` 675 -> 686, `index` 560 -> 565, because the new lazy boundary
re-partitioned the shared chunks again. It also costs the thing an examples
site exists for — an example is meant to be pasted and run, so `lazy` belongs
in one only when the example is *about* deferring something.
