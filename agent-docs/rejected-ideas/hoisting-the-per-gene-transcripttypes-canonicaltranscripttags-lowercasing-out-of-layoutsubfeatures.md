---
name: hoisting-the-per-gene-transcripttypes-canonicaltranscripttags-lowercasing-out-of-layoutsubfeatures
description: Hoisting the per-gene `transcriptTypes` / `canonicalTranscriptTags` lowercasing out of `layoutSubfeatures` / `scoreIsoforms` into a config-keyed `WeakMap`
area: performance-and-measurement
---

# Hoisting the per-gene `transcriptTypes` / `canonicalTranscriptTags` lowercasing out of `layoutSubfeatures` / `scoreIsoforms` into a config-keyed `WeakMap`

measured 2026-08-18 and reverted rather than shipped. 20k genes
x 4 isoforms went **313-365ms before, 324-349ms after**: noise. The two
`.toLowerCase()` maps are per gene and look like an obvious hoist, which is why
this is written down.
