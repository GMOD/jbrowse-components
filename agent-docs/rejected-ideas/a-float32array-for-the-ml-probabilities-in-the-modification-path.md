---
name: a-float32array-for-the-ml-probabilities-in-the-modification-path
description: A `Float32Array` for the ML probabilities in the modification path
area: performance-and-measurement
---

# A `Float32Array` for the ML probabilities in the modification path

—
measured 2026-08-14 and declined at **1.008x**, inside its own control (0.994).
It was the obvious first hypothesis: `getModProbabilities` returns
`Array.from(ml, v => (+v + 0.5) / 256)`, a boxed `number[]` per read, thousands
of entries on a nanopore read. Not the cost. The cost, on the same fixture and
run, was the object per **position** in the running-best array — 4.01x when
that became a packed `Uint16Array`
(`plugins/alignments/benches/modExtract.bench.ts`, both arms still in it). So
price the container that scales with called positions, not the one that scales
with values.
