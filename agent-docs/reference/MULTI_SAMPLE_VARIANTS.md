---
name: multi-sample-variants
description: How a VCF's genotypes reach the multi-sample variant cell loops — the interned-code pipeline that replaced a per-feature name-keyed record, what each half of it measured, and the two encodings (packed genotype key, header remap) that only make sense together. Read before adding a consumer of genotype data, before reintroducing anything keyed by sample name on the per-cell path, or before re-evaluating either optimization on its own.
---

# Multi-sample variant genotypes: the code pipeline

The per-feature × per-sample loops in `computeVariantCells.ts` and
`computeVariantMatrixCells.ts` run 10⁸+ times on a real panel, so what a
genotype *is* on that path has been rebuilt twice. This is the current shape and
what each step bought. The rules that follow from it are in
`plugins/variants/src/CLAUDE.md`; this is the evidence behind them.

## Genotypes reach the cell loops as codes, never as strings

`computeSampleInfo` makes one `processGenotypes` pass per feature — the
`@gmod/vcf` callback that reports a genotype as a *range into the line* rather
than as a string — and from that single pass it:

- interns `genotypeCodes`,
- accumulates `sampleInfo` (ploidy, phasing),
- folds the legend flags.

The cell loops then index those codes by a source's column
(`buildSourceSampleIndices`, resolved once per pass) and key their style memos by
code, so a genotype string is materialized **once per (site, distinct genotype)**
rather than once per cell.

What this replaced was a `Record<sampleName, genotype>` per feature, built by
`GENOTYPES()` and walked three more times — flags, colors, interning — to
reproduce a payload the worker only ever ships as codes.

**Measured:** the analyze+cells stage went **613ms → 168ms** on 2504 samples ×
400 variants, and the 168ms *covers the cell painting the 613ms doesn't*.

## Nothing on the per-cell path may be keyed by sample NAME

The callback runs once per cell, so a string-hash lookup there is 10⁸ hashes on a
real panel. `sampleInfo` was exactly that: an object with one property per
sample, looked up by name to accumulate ploidy and phasing.

It accumulates into typed arrays indexed by the column the callback already
holds, and folds into the name-keyed `Record` once after the pass, through the
same `accumulateSampleInfo` the record path uses so a mixed fetch still agrees.
The fold has to run **before** the record block, which reads `sampleInfo`'s keys
to extend the canonical order. Ploidy 0 means "column never reported", which is
what keeps a genotype-less sample out of `sampleInfo`.

## The site memo probes by packed int where it can

`packGenotypeKey` folds a genotype of ≤4 ASCII chars — every diploid call an
ordinary VCF spells — into one int, so recognizing a repeat is an int compare
rather than a two-range character walk.

Longer genotypes (polyploid, two-digit allele indices at a decomposed
multiallelic site) key 0 and keep the range compare. A non-ASCII code unit
**declines to pack** rather than truncating, because a truncated unit could land
on another genotype's key and paint the wrong cell.

## The two measured together, and why that matters

<!-- measurement: genotype-codes-speedup -->

| corpus | speedup |
| --- | ---: |
| 1000G phase 3 (2504 samples) | **1.87x** |
| 1000G high-coverage (3202 samples, `GT:AB:AD:DP:GQ:PGT:PID:PL`) | **2.47x** |

Byte-identical codes, dictionary, sample order, ploidy/phasing and legend flags
across the change.

**The packed key measured 1.02x on its own and read as not worth having.** The
name lookup was masking it, and it was worth another 1.15x once that went.
**Don't re-evaluate either half in isolation** — this is the trap the pair
exists to record, not a footnote to the table.

## A code's column is the canonical `sampleNames` position

Never `processGenotypes`' `sampleIdx`. That callback numbers samples against the
header of the file *its own* feature came from; `sampleNames` is the union of
every header in the fetch.

The two are the same list for a single-header adapter — which is all of them but
`SplitVcfTabixAdapter` — and are **not** the same list when per-contig files
order or omit samples differently, which is the case the union exists for.
`buildHeaderRemap` translates header position to column and answers `undefined`
when they already agree, so the common fetch keeps its direct index and pays no
extra read.

Writing `codes[sampleIdx]` filed each genotype, and each sample's ploidy, against
a *neighbouring* sample on any multi-contig view over such files — silently,
since every row still held a real genotype. `phaseSetReader` reads PS through the
same callback and so needs the same translation.

## Phase-set coloring reads PS through `processFormatFields`, not `samples`

`feature.get('samples')` parses every FORMAT field of every sample — an object
and an array apiece — to reach one:

<!-- measurement: format-fields-vs-samples -->

| callset | `samples` | `processFormatFields` |
| --- | --- | --- |
| 100 samples, 2k variants | 343ms / 239MB | 33ms / 4MB |
| 500 samples, 2k variants | 1686ms / 1.17GB | 113ms / 4MB |

`makePhaseSetReader` is shared by both cell loops rather than written twice,
because the two displays paint the same phase sets and a second copy of the
absent/malformed rules is how they drift. An absent column, an empty field and
`.` all mean "no phase set" and fall back to allele coloring, while a
present-but-unparseable id is NaN and paints hue 0 — which is what `SAMPLES()`'
`+` coercion produced.

GT is deliberately not read there; it comes from the interned codes, so there is
one source of it. An adapter that can't report FORMAT ranges paints by allele,
the same outcome an absent `samples` field already gave.

## Codes are Uint32

They were Uint16, which capped the dictionary at 65535 distinct genotype strings
— reachable on a decomposed pangenome callset, where a multiallelic site's
genotypes grow with the square of the alt count. Past the cap a genotype interned
to 0, and **0 now means "this sample has no call"**, so the cell loops would
decline to paint it at all.
