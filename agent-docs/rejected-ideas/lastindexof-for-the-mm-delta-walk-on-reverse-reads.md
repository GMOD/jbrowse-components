---
name: lastindexof-for-the-mm-delta-walk-on-reverse-reads
description: `lastIndexOf` for the MM delta walk on reverse reads
area: performance-and-measurement
---

# `lastIndexOf` for the MM delta walk on reverse reads

the mirror image of
a change that shipped, measured 2026-08-14 at **0.786x** against a 0.972x
control, positions identical. Forward reads find each call with
`indexOf` and that is 1.560x (`benches/mmDeltaJump.bench.ts`); doing the
obviously symmetric thing on the reverse half is materially SLOWER than the
`charCodeAt` stepping it would replace, so reverse still steps.

Reverse is half the reads, so this is not a rounding error in the decision: the
both-strands version nets **1.094x** where branching on strand nets **1.263x**.
Most of the win is thrown away by the half that loses, and a forward-only probe
cannot see it — the probe that motivated the work reported 1.42x and filtered
reverse reads out.

**The generalisable bit is that a native string search is not one primitive.**
`indexOf` and `lastIndexOf` are different enough in V8 that a mechanism
argument covering both ("a native scan beats a JS loop") predicts the wrong
sign for one of them. htslib's third option — parsing the delta list backwards
from `MMend[]` — is untried and is the thing to measure if reverse is revisited.
