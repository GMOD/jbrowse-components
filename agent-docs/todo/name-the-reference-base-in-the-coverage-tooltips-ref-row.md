---
name: name-the-reference-base-in-the-coverage-tooltips-ref-row
description: the row cannot say `Ref (G)` because the reference base is not on the main thread; cost a one-base fetch on hover, and check whether GetConsensusSequence is already the seam
metadata:
  area: alignments
  category: ready
---

# Name the reference base in the coverage tooltip's `Ref` row

That row reports a count — depth minus the alts — and cannot say `Ref (G)`,
because the reference base is not on the main thread. `extractFeatureArrays`
takes `regionSequence` but reads it only under bisulfite colouring
(`colorBy?.type === 'bisulfite'`, verified 2026-08-26), so nothing else in the
pileup ever sees it.

Shipping the region sequence per fetch to letter one tooltip row is the wrong
trade. The version worth costing is a **one-base fetch on hover**, next to the
widget round trip the click already makes.

**Check `GetConsensusSequence` first.** It landed after this item was written
and already fetches `regionSequence` / `regionSequenceStart` on its own RPC
(`RenderAlignmentDataRPC/GetConsensusSequence.ts`), so the seam for "ask the
worker for reference sequence outside a render" may exist rather than needing to
be built. Whether it can answer a single base cheaply is the thing to read
before designing a new method.
