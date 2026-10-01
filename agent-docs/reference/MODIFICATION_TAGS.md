---
name: modification-tags
description: How this repo reads MM/ML base-modification tags against htslib's sam_mods.c — what matches, the deliberate differences, and the traps. Read before touching getModPositions or forEachMaxProbMod.
kind: spec
---

# MM/ML tags: us and htslib

htslib's `sam_mods.c` is the reference implementation; its header comment is the clearest
prose on the tag's semantics.

## Two things called "multiple types"

- A **combined code** is several types on the same base at the same positions (`C+mh`):
  one delta list, ML values interleaved per position. Legal, and not what dorado emits:
  ONT reads carry `A+a.;C+h?;C+m?`, 5mC and 5hmC as two separate groups on C.
- **Several MM groups** (`C+m,…;A+a,…`) are different bases with separate delta lists and
  ML spans.

The commonest real shape is several groups with two on the same base.

## What matches htslib

- Combined-code types share one `positions` array and group by identity
  (`modifications[end].positions === positions` in `forEachMaxProbMod`), as htslib does by
  pointer compare.
- The ML layout is `probStart` + `probStride`, htslib's `ML[]` + `MLstride[]`.
- The 256-type ceiling (`MAX_BASE_MOD`): `forEachMaxProbMod` packs a mod index into the high
  byte of a `Uint16Array`. htslib errors past it; we silently alias. No real basecaller
  reaches it.

## Where we differ

**We materialize `positions: number[]`; htslib streams.** Three consumers need random
access after the walk: `getMethBins` (cytosine context), the tooltip index, and
`forEachMaxProbMod`'s single ascending CIGAR walk.

**We walk the read once per distinct group; htslib walks once for all types.**
`getModPositions` restarts `currPos = 0` per group. Groups with the same base, strand and
delta text share a walk, decided at parse time (`sameBaseMerge.bench.ts`). htslib's
one-pass shape (`multiGroupParse.bench.ts`) loses below three distinct groups and wins only
at Fiber-seq's, so it is a Fiber-seq optimization: branch on the distinct count, not the
group count.

## When an MM tag asks for more of a base than the read has left

`getModPositions` clamps to the nearest valid index (`seqLength - 1` forward, `0` reverse)
for that call and every later call, so every emitted position is a valid index. Positions
are used as indices and must ascend for the CIGAR walk; an out-of-range one resolves to a
wrong reference position instead of being dropped.

**The stepping loop is a do-while**, so before the clamp each call after the first overrun
emitted `seqLength`, `seqLength + 1`, …. No fixture overruns, so nothing exercised it.
`mmDeltaJump.bench.ts --overrun` forces the case, inflating the second-to-last delta.

## Forward reads jump; reverse reads step

Forward calls use single-character `indexOf`; reverse reads keep the `charCodeAt` loop.
**`lastIndexOf` is not the mirror of `indexOf`**: it measured slower than the loop
(`mmDeltaJump.bench.ts`), so applying the change to both strands keeps little of the forward
win. Strand matters far more than regime.

## Only the fetched region is walked

`extractModifications` maps the region to read offsets (`refWindowToRead`) and
`getModPositions` keeps only calls inside it. Deltas count from the read's 5' end, so the
stretch before the window is consumed as a count of its base. `probStart` moves past the
skipped calls so ML indexing is unchanged. `modWindow.bench.ts` measures it.

## What htslib validates that we do not

- `MN` against `l_qseq`: htslib errors; `getModTag` drops the MM tag on mismatch.
- A run-over: htslib warns; we clamp silently.
- `HTS_MOD_REPORT_UNCHECKED` (explicit `?` tags, "not looked for" vs "not found"): we carry
  `unknownSkip` but nothing exposes the third state.
