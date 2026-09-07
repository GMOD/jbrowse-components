---
name: single-sourcing-the-feature-get-overload-block
description: Single-sourcing the `Feature.get` overload block
area: config-and-mst
---

# Single-sourcing the `Feature.get` overload block

tried 2026-08-16 and
declined. Nine files restate the same eight-line overload list: the `Feature`
interface and every class implementing it (SimpleFeature, Bam ×2, Cram, Sam,
Vcf, NCList, Gff3, Synteny). They are **not** redundant — deleting the class
copies breaks ~40 call sites, because a class whose only `get` returns
`unknown` is not assignable to `Feature`, whose `get('refName')` returns
`string`.

Two ways out, both worse:

- **Interface/class declaration merging** (`interface X extends Feature {}`
  beside `class X`) does not work at all. The class's own `get` declaration
  wins over the merged one, so the overloads never reach the class type and the
  same call sites break.
- **An abstract base carrying the overloads** and delegating to a
  `protected abstract getRaw` does work, and puts a megamorphic call on
  `feature.get(...)` — which `plugins/alignments/src/CLAUDE.md` names as the
  per-read hot path to keep work out of, across eight implementations sharing
  one call site in the base.

The copies are self-checking: a wrong one fails its own `implements Feature`.
Verbose, safe, and cheaper than either alternative.
