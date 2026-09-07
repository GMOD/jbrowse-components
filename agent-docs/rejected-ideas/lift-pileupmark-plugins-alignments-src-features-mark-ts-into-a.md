---
name: lift-pileupmark-plugins-alignments-src-features-mark-ts-into-a
description: Lift `PileupMark` (`plugins/alignments/src/features/mark.ts`) into a shared package so MAF's per-base cells or the multi-sample variant cells declare their marks through it
area: rendering-and-displays
---

# Lift `PileupMark` (`plugins/alignments/src/features/mark.ts`) into a shared package so MAF's per-base cells or the multi-sample variant cells declare their marks through it

declined 2026-08-29 at the census, before a line
moved. The contract cures main-thread triple-spelling: three files walking
per-instance arrays with independently written predicates and gates. Neither
candidate has that disease, and each holds parity by a mechanism that is
*stronger for its data shape*. MAF has no per-instance index space at all —
its Canvas2D painter walks block × row × sampled column off block byte data,
its GPU encode run-length-merges same-coloured cells (instance count = colour
transitions, `mafInstanceBuffer.ts`), its hit test is row/column arithmetic
(`mafHitTest.ts`), and the shared declaration is the colour resolve
(`resolveCellPacked`) plus the geometry mappers; materializing cell instances
for `rows(data)` would allocate per base and destroy the run merge. Variants
resolves everything once in the **worker** (`computeVariantCells`) and every
consumer — GPU, Canvas2D, and by documented design the hit test
(`findCellIndex` reads the render arrays "so the hit-test cannot disagree
with what is on screen") — reads the same shipped arrays: `alpha` is
pre-resolved packed ABGR, `hittable` is absence from the array, `selects` is
a paint-order bucket reorder not a selection, matrix-mode x is feature-index
with no per-cell `startBp/endBp`, and adopting `findMarkAt`'s linear row scan
would regress the binary search that replaced a 16-byte-per-cell spatial
index. So a lift would move the type and neither consumer — the
member-only-one-display-exercises kill condition, twice. What a re-proposal
has to bring: a display whose pack, paint and hit test are written separately
on the MAIN thread over per-instance arrays, with per-frame gates
(`alpha`/`hittable`) that cannot be worker-resolved — that display has the
disease the contract cures, and admission is ADR-090's surviving clause, a
second consumer's pull. The remaining `PileupMark` work is in-plugin
(`ideas/one-mark-declaration-per-feature.md`: the `point`-on-a-bp-edge shape
for insertion + clip), not cross-display.
