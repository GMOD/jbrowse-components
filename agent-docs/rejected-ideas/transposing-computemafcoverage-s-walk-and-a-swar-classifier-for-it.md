---
name: transposing-computemafcoverage-s-walk-and-a-swar-classifier-for-it
description: Transposing `computeMafCoverage`'s walk, and a SWAR classifier for it
area: performance-and-measurement
---

# Transposing `computeMafCoverage`'s walk, and a SWAR classifier for it

—
both measured, both worse. The transpose is 0.92x–1.06x; exact-semantics SWAR
is 0.51x, and the 4.5x a SWAR kernel does show is bought by reclassifying `.`
and `*` as non-bases, so it is the semantic change priced rather than a win.
[MAF_WORKER_PIPELINE.md](../reference/MAF_WORKER_PIPELINE.md) has the numbers and the
zero-byte-test trap.
