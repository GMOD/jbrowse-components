---
name: scanning-the-mm-delta-list-instead-of-split
description: Scanning the MM delta list instead of `split(',')`
area: performance-and-measurement
---

# Scanning the MM delta list instead of `split(',')`

measured 2026-08-14 at
**1.056x / 1.085x** against controls of 0.995 / 1.006, output identical,
declined on the size of the number rather than the risk. The allocation is
real: a nanopore read declares ~950 calls, so the split builds ~950 substrings
per read — 0.84M over `200x.longread.mod.bam` — purely to run `+` over each and
throw them away. That is about a twentieth of the pipeline, against a
hand-rolled integer parser that reads a malformed tag differently from `+`
(digits only, vs `+`'s whitespace/sign/float/NaN).
`plugins/alignments/benches/mmParseShape.bench.ts`, both arms kept.

**The negative is what located the real cost**, which is the generalisation
worth keeping: `modPhases.bench.ts` puts the whole parse phase at 46% of the
per-read pipeline, and this says only a tenth of that is the substrings. The
rest is the delta walk stepping through 43.7 Mbp of read sequence one
`charCodeAt` at a time. `seqscan.probe.ts` prices `indexOf` jumps over that at
1.42x — the candidate this measurement redirected to, and it is in TODO.md.
