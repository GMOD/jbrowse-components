---
name: modification-tags
description: How this repo reads MM/ML base-modification tags, checked against htslib's sam_mods.c — what matches, the one deliberate difference, and the per-type walk that gates two optimizations. Read before touching getModPositions or forEachMaxProbMod.
kind: spec
---

# MM/ML tags: us and htslib

htslib's `sam_mods.c` is the reference implementation, and its header comment is the
clearest prose anywhere on the tag's semantics. This doc records how our reader
compares to it.

## The vocabulary: two different things get called "multiple types"

- A **combined code** is several types on the SAME canonical base at the SAME positions:
  `C+mh` is 5mC and 5hmC at every listed cytosine. One delta list, one set of positions,
  ML values **interleaved** per position (htslib's `<simple-mod-list>`). **Legal,
  specified, and not what dorado emits**: ONT's HG002 chromatin-accessibility reads
  declare `..._5mCG_5hmCG@v1,..._6mA@v1` yet all carry `A+a.;C+h?;C+m?`, 5mC and 5hmC as
  two SEPARATE groups on C. Don't reason about "the 5mCG_5hmCG model" as producing `C+mh`.
- **Several MM groups** is `C+m,…;A+a,…`: different canonical bases, therefore separate
  delta lists and ML spans (what a Fiber-seq read carries).

A tag can be both (`C+mh,…;A+a,…`). The commonest real shape is a third one: **several
groups, two of them on the same canonical base**, which nothing here was shaped for.

## Two things we do the same way as htslib

- **Combined-code types share one delta list and are grouped by IDENTITY, not by comparing
  values.** htslib coalesces with a pointer compare on its `MM[]` pointers; we hold one
  `positions` array across a group's entries and coalesce with
  `modifications[end].positions === positions` (`forEachMaxProbMod`). It cannot be wrong
  about whether two walks coincide.
- **The ML layout is `probStart` + `probStride`**, htslib's `ML[]` + `MLstride[]`
  (`C+mhfc,10,15` has four types at one delta position, ML holding
  `Q(m0)Q(h0)Q(f0)Q(c0)` then `Q(m1)…`, stride 4; ours is `probStart: mlBase + j,
  probStride: nTypes`).
- **The 256-type ceiling is theirs too** (`MAX_BASE_MOD`). `forEachMaxProbMod` packs a mod
  index into the high byte of a `Uint16Array`, so it has the same limit. htslib **errors**
  past it; we silently alias (`(m + 1) << 8` at m = 255 truncates to 0). Not reachable from
  any real basecaller.

## The one place we deliberately differ

**htslib never materializes positions; we do, and have to.** Its state is a pointer into MM
and a countdown per type, streamed one base at a time. We build `positions: number[]` per
group because three consumers need random access after the walk: `getMethBins` indexes
`positions[idx]` to test cytosine context, the tooltip index is built from it, and
`forEachMaxProbMod` needs the whole ascending list for one CIGAR walk. "htslib doesn't
allocate" is not on its own an argument for changing this.

## The structural difference, and how much is left

**htslib walks the read sequence ONCE for every type at once; we walk it once per DISTINCT
group.** `getModPositions` restarts `currPos = 0` for each group it walks, because each group
counts occurrences of its own canonical base. Two mechanisms reduce that:

- **The types of one group share a walk** (`C+mh` yields one array, two entries pointing at it).
- **Two groups with the same base, strand and delta list share a walk**, decided by comparing
  the delta text at parse time. This is dorado's `C+h?;C+m?`, the common case:
  `sameBaseMerge.bench.ts` prices it at 1.268x on the parse.

So `A+a.;C+h?;C+m?` is three groups and **two** walks; a Fiber-seq read `C+m;A+a;T-a` is three
groups and three walks. `forEachMaxProbMod` shares a CIGAR walk across entries sharing a
positions array, worth little (1.08x) because the phase is bound by per-call work
(`cigarOpDensity.bench.ts`).

**What is left is a Fiber-seq optimization, not a general one.** `multiGroupParse.bench.ts`
implements htslib's one-pass shape and it **loses** below three distinct groups (0.917x at
one, 0.949x at the ONT fixture's two), winning only at fiberseq's ~2.9: one pass charges every
read base an array index and property loads where the per-group loop is a tight `charCodeAt`
do-while. Branch on the **distinct** count, not the group count. The hard constraint if built
is the end-of-sequence rule below.

## When an MM tag asks for more of a base than the read has left

`getModPositions` clamps to the nearest valid index (`seqLength - 1` forward, `0` reverse) for
that call and every call after it, so **every emitted position is a valid index into the
read**. That matters because positions are used as indices (`getMethBins` reads the sequence
at them) and must be ascending for the CIGAR walk; an out-of-range one resolves to a wrong
reference position rather than being dropped.

**It did not always, and the failure is the thing to recognize.** The stepping loop is a
do-while, so after one call exhausted the sequence each later call advanced `currPos` past the
end and emitted `seqLength`, `seqLength + 1`, … (negatives on reverse); only the FIRST overrun
landed in range. A comment asserting `currPos <= seqLength by loop invariant` sat above the line
that broke it. No fixture overruns, so nothing exercised it, and the one-pass arm in
`multiGroupParse.bench.ts` disagreed with its baseline while reporting "output identical".
`mmDeltaJump.bench.ts --overrun` forces the case, inflating the SECOND-to-last delta, because
the first unplaceable call is the one that already behaved.

## Forward reads jump; reverse reads step

`getModPositions` finds each forward call with a single-character `indexOf` (`delta + 1` native
searches instead of one step per base) and keeps the `charCodeAt` loop on reverse reads.
`mmDeltaJump.bench.ts` (parse phase): forward `indexOf` 1.56x sparse / 1.25x dense; reverse
`lastIndexOf` 0.79x; what ships (branch on strand) 1.26x / 1.19x. **`lastIndexOf` is not the
mirror of `indexOf`**: applying the change to both strands keeps only 1.09x of a 1.56x win, and a
mechanism argument covering both ("a native scan beats a JS loop") predicts the wrong sign for
one. Strand matters far more than regime, so there is no fixture-shape branch to make. htslib
parses the reverse delta list backwards from `MMend[]`, untried here.

## Only the fetched region is walked

`extractModifications` maps the region onto read offsets (`refWindowToRead`) and hands that
window to `getModPositions`, which keeps only the calls inside it. Deltas count from the read's
5' end (the end of the stored sequence on a reverse read), so the stretch before the window is
consumed as a count of its base, four bytes per step over `TextEncoder.encodeInto`'s copy, with
whole deltas subtracted. Nothing past the window's far edge is walked. Each entry's `probStart`
moves past the skipped calls, so ML indexing is unchanged. `forEachMaxProbMod` and `getMethBins`
walk the CIGAR from the window's first op. `modWindow.bench.ts`: ~5x on a 1 kb view, parity over
whole reads; the count and the SEQ decode are still O(read).

## What htslib validates that we do not do at all

- **`MN` against `l_qseq`**: htslib errors when MM/MN length disagrees with the sequence (a
  hard-clipped or trimmed read). `getModTag` reads `MN` and drops the MM tag on a mismatch, so
  the read shows no modifications rather than an error.
- **A run-over is reported**: htslib warns "MM tag refers to bases beyond sequence length"; we
  clamp silently.
- **`HTS_MOD_REPORT_UNCHECKED`** distinguishes "not looked for" from "looked for and not found"
  on explicit (`?`) tags. We carry `unknownSkip` (and `getMethBins` uses it to decide
  fill-unmarked) but nothing exposes the third state.

None is a bug in what we ship; they are the checks a stricter reader would have.
