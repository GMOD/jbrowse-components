---
name: modification-tags
description: How this repo reads MM/ML base-modification tags, checked line by line against htslib's sam_mods.c — the two things we do the same way and should keep doing, the one place we deliberately differ and why, and the structural difference (htslib walks the read once for every modification type at once, we walk it once per type's canonical base) that gates two open optimizations. Read before touching getModPositions, forEachMaxProbMod, or proposing anything about multi-type reads.
---

# MM/ML tags: us and htslib

`~/src/vendor/htslib/sam_mods.c` is the reference implementation and its header
comment is the clearest prose anywhere on the tag's semantics. Cross-referenced
against it at **htslib 1.23.1-13-gb8863d7d**. Line numbers below are from that
revision and are a starting point, not a contract.

## The vocabulary, because two different things get called "multiple types"

Everything below turns on this distinction, and conflating the two is what sent a
session's framing wrong before it was caught:

- A **combined code** is several types on the SAME canonical base at the SAME
  positions: `C+mh` is 5mC and 5hmC at every listed cytosine. One delta list, one
  set of positions, ML values **interleaved** per position. htslib's grammar
  calls this `<simple-mod-list>`.

  **Legal, specified, and not what dorado emits.** ONT's public
  chromatin-accessibility run for HG002 declares
  `modbase_models=..._5mCG_5hmCG@v1,..._6mA@v1` in its header, and all 8,166
  reads of the `ont.6ma.chr20.bam` slice are `A+a.;C+h?;C+m?` — 5mC and 5hmC as
  two SEPARATE groups on C, no combined code anywhere. Do not reason about "the
  5mCG_5hmCG model" as though it produced `C+mh`; this repo did, in a landed
  commit message, and the corpus that would have caught it did not exist yet.
- **Several MM groups** is `C+m,…;A+a,…` — 5mC on cytosine and 6mA on adenine.
  Different canonical bases, therefore necessarily different positions, separate
  delta lists, separate ML spans. This is what a Fiber-seq read carries, and it
  is the commoner of the two shapes.

A tag can be both at once (`C+mh,…;A+a,…`). What the ONT fixture shows is the
third combination and the commonest one: **several groups, two of them on the
same canonical base**, which is neither a combined code nor the different-base
case, and which nothing in this repo was shaped for.

## Two things we do the same way as htslib

**Combined-code types share one delta list, and both implementations group them
by IDENTITY rather than by comparing values.** htslib holds `char *MM[256]`
pointers into the tag string and coalesces with a pointer compare —
`for (j=i+1; j < state->nmods && state->MM[j] == MMptr; j++)`
(`sam_mods.c:537`). We hold one `positions` array shared across a group's entries
and coalesce with `modifications[end].positions === positions`
(`forEachMaxProbMod`). Same trick, same reason: it can never be wrong about
whether two walks coincide, where an equality test could be.

**The ML layout is `probStart` + `probStride`, which is htslib's `ML[]` +
`MLstride[]`.** Its comment spells the interleave out: `C+mhfc,10,15` gives four
types pointing at the same delta position, with ML holding
`Q(m0)Q(h0)Q(f0)Q(c0)` then `Q(m1)Q(h1)Q(f1)Q(c1)`, and a stride of 4. Ours is
`probStart: mlBase + j, probStride: nTypes`. Identical.

**And the 256-type ceiling is theirs too.** `MAX_BASE_MOD 256`
(`sam_mods.c:175`). `forEachMaxProbMod` packs a mod index into the high byte of a
`Uint16Array`, so it has the same limit arriving from a different direction —
which is the external check on that function's "there is no such read" comment.
One difference worth knowing: htslib **errors** past its cap, we would silently
alias, because `(m + 1) << 8` at m = 255 truncates to 0 in a `Uint16Array`. Not
reachable from any real basecaller, and not worth code to prevent, but it is a
silent failure rather than a loud one.

## The one place we deliberately differ

**htslib never materializes positions; we do, and have to.** Its whole state is
fixed-size — a pointer into MM and a countdown per type ("no. canonical bases
left until next mod") — and it streams: `bam_mods_at_next_pos` consumes one base
and reports whatever landed there. Its header says so outright: "We do not
allocate additional memory other than the fixed size state."

We build `positions: number[]` per group because three consumers need random
access to it after the walk, not just during it — `getMethBins` indexes
`positions[idx]` to test cytosine context, the tooltip index is built from it,
and `forEachMaxProbMod` needs the whole ascending list to drive one CIGAR walk.
A streaming reader would have to re-walk for each.

So this is a real difference in shape, not an oversight, and "htslib doesn't
allocate" is not on its own an argument for changing it. What it *is* good for is
the next section.

## The structural difference, and how much of it is left

**htslib walks the read sequence ONCE for every type at once. We walk it once per
DISTINCT group.**

`bam_next_basemod` takes the minimum countdown per canonical base across all
types, then makes a single pass counting base frequencies until one of them
reaches its threshold, then decrements every type's countdown by the frequencies
observed. One pass over the sequence, however many groups the tag has.

`getModPositions` restarts `currPos = 0` for each group it has to walk, because
each group counts occurrences of its own canonical base. Two things reduce how
often that happens, and they are different mechanisms:

- **The types of one group share a walk.** `C+mh` calls both types at the same
  positions, so it yields one array and two entries pointing at it.
- **Two groups with the same base, strand and delta list share a walk too**,
  decided by comparing the delta text at parse time. This is dorado's
  `C+h?;C+m?`, and it is the common case rather than the exotic one:
  `sameBaseMerge.bench.ts` prices it at **1.268x on the parse** and 1.222x on the
  per-read pipeline at 72.8 Mbp.

So `A+a.;C+h?;C+m?` is three groups and **two** sequence walks. A Fiber-seq read
with `C+m;A+a;T-a` is three groups and three walks, because those are three
different canonical bases.

The same sharing applies one layer down for free: `forEachMaxProbMod` groups
entries by positions-array identity, so entries that share an array share a CIGAR
walk. That half is worth much less than it looks — 1.08x against the parse's
1.27x — because the phase is bound by per-call work rather than traversal, which
`cigarOpDensity.bench.ts` established independently.

**What is left of the difference is a Fiber-seq optimization, not a general
one.** `multiGroupParse.bench.ts` implements htslib's shape against the baseline
above and it is a **loss** below three distinct groups: 0.917x at one, 0.930x at
two synthesized, 0.949x at the two real ones of the ONT fixture, and 1.385x only
at fiberseq's 2.86. One pass charges every read base an array index and several
property loads where the per-group loop is a tight `charCodeAt` do-while; two
saved passes do not cover that. Anything built here must branch on the
**distinct** count, not the group count.

**The one hard constraint if it is ever built**: an MM tag may ask for more of a
base than the read has left, and the two shapes did not agree there. The
per-group walk clamps, recording `seqLength - 1` (forward) or `0` (reverse) for
every call it cannot place; the one-pass arm silently dropped them until this was
fixed, and its "output identical" rows had only meant that no read in those
fixtures overran. It is the same end-of-sequence rule the `indexOf` idea has to
reproduce.

**And it settles what to do about `indexOf`.** Replacing the per-base delta walk
with `indexOf` jumps measures 1.42x in isolation (`seqscan.probe.ts`, forward
strand only). That was recorded here as *competing* with the one-pass shape,
since a single-character search cannot count several canonical bases at once. It
no longer competes on ONT data: one pass is a loss at two distinct groups, so
there is nothing there for jumping to be an alternative to. The two are only
alternatives on Fiber-seq-shaped tags.

## What htslib validates that we do not do at all

- **`MN` is checked against `l_qseq`.** htslib errors when the MM/MN data length
  disagrees with the sequence length, which catches a hard-clipped or trimmed
  read whose MM tag no longer describes it. We never read `MN`.
- **A run-over is reported.** htslib warns "MM tag refers to bases beyond
  sequence length" when deltas remain after the sequence ends. We clamp silently
  — `currPos` stops at `seqLength` and the position records as `seqLength - 1`.
- **`HTS_MOD_REPORT_UNCHECKED`** distinguishes "not looked for" from "looked for
  and not found" on explicit (`?`) tags, for consensus counting. We carry the
  `unknownSkip` flag that the distinction rests on, and `getMethBins` uses it to
  decide fill-unmarked, but nothing exposes the third state.

None of these is a bug in what we ship today; they are the checks a stricter
reader would have, listed so nobody has to re-read `sam_mods.c` to find out
whether we have them.
