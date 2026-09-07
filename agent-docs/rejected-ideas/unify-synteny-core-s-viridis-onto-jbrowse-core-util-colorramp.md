---
name: unify-synteny-core-s-viridis-onto-jbrowse-core-util-colorramp
description: Unify `synteny-core`'s viridis onto `@jbrowse/core/util/colorRamp`'s 256-stop table
area: comparative-and-pangenome
---

# Unify `synteny-core`'s viridis onto `@jbrowse/core/util/colorRamp`'s 256-stop table

measured 2026-08-30 and declined. `colorRamps.ts:46`
interpolates ten stops where the core spec keeps all 256, and the ten are
exact core entries at indices 0, 28, 56, 85, 112, 142, 170, 199, 227, 255 — so
this really is the "interpolation over a subset" that the core table's own
comment exists to prevent. It is also invisible: over 10,001 samples of `t`,
94.3% land on a different colour and the largest single-channel gap is
**16/255**, at `t ≈ 0.947` in the yellow end. Against that, unifying moves
every rendered dotplot and synteny identity colour, rewrites the bytes
`dotplotColors.test.ts:74,77` pins, and needs a golden refresh — a colour move
no reader can see, for a de-duplication no reader can see either. Reopen if
the two ever have to agree exactly: a legend drawn from one table beside a
canvas drawn from the other would show the gap at a seam.
