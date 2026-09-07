---
name: parsing-vcf-genotypes-from-raw-bytes-instead-of-decoding-the
description: Parsing VCF genotypes from raw bytes instead of decoding the line to a string
area: performance-and-measurement
---

# Parsing VCF genotypes from raw bytes instead of decoding the line to a string

measured 2026-08-11, and it is backwards: the decode is nearly free
and the byte scan is *slower*. `TextDecoder` does 28.9 MB of 1000G lines in
7.4ms (~3.9 GB/s), 6% of what the genotype pass costs, and it produces a flat
one-byte string that `charCodeAt` reads as fast as `Uint8Array` indexing.
Worse, `String.prototype.indexOf` beats `Uint8Array.prototype.indexOf` by ~2x
on the same search, so the byte version gives up the one primitive the scan
most wants. What the investigation found instead was 2.1x, in two places
neither of which is the decode. In `@gmod/vcf` (`28300b1`, `781a3e9`): hop
between samples with `indexOf` rather than a `charCodeAt` loop, and hand the
scans the *flat line plus offsets* rather than a `line.slice()` — a V8
`SlicedString` costs an unwrap on every `charCodeAt`, which is all this scan
does. In `computeSampleInfo` (`f016ae9b97`): accumulate ploidy/phasing by
column instead of by sample name, and probe the site memo by packed int. A
whole warm fetch of 1239 records × 3202 samples went **815.9ms → 387.0ms**,
with the tabix stage unchanged at ~90ms and identical interned codes. Same
lesson as tabix-js ADR 0003, from the other side.
