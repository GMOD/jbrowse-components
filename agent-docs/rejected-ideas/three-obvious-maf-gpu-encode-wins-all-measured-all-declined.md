---
name: three-obvious-maf-gpu-encode-wins-all-measured-all-declined
description: Three "obvious" MAF GPU-encode wins, all measured, all declined.
area: performance-and-measurement
---

# Three "obvious" MAF GPU-encode wins, all measured, all declined.

Landing
the row-flank byte mask (`ca02f1aba0`, 2.4x on that index) made the rest of
`buildInstanceBuffer` worth profiling; nothing else in it is worth touching.
Measured on the UCSC ce11 26-way shape — 48k blocks, median 7bp, 26 rows,
8.7M cells — interleaved in one process:
- **Growing the instance writer by doubling instead of seeding it from
  `maxInstances`.** The seed overshoots 4.3x there (140MB reserved for a 32MB
  result), which reads like an obvious waste and is not: the pages are lazily
  mapped, so the reservation costs **0.34ms** and only the written prefix ever
  faults in. Doubling from 1/8 measured **34ms** against the **16ms**
  right-sizing copy `finish()` already pays — strictly worse, and it gives up
  the single-allocation property.
- **A reused scratch buffer for `buildColumnForGenomicOffset`** (the shape
  `IdentityColumns` uses in `drawRowIdentity.ts`, where it *was* worth it).
  1.7–3.1x on the index build itself, but that build is **under 1%** of the
  encode — so it buys ~3ms and costs callers a shared mutable buffer that a
  future one could retain across blocks and silently read the wrong columns.
- **Hoisting `packMafCellColorConfig` out of the per-region encode** into a
  display-level computed. It really is per-display state rebuilt per region,
  but it is **0.1–0.3ms per region** — ~0.05% of an encode wave.
