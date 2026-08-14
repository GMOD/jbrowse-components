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
- **Several MM groups** is `C+m,…;A+a,…` — 5mC on cytosine and 6mA on adenine.
  Different canonical bases, therefore necessarily different positions, separate
  delta lists, separate ML spans. This is what a Fiber-seq read carries, and it
  is the commoner of the two shapes.

A tag can be both at once (`C+mh,…;A+a,…`), and newer basecallers emit exactly
that.

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

## The structural difference that gates two open items

**htslib walks the read sequence ONCE for every type at once. We walk it once per
group.**

`bam_next_basemod` takes the minimum countdown per canonical base across all
types, then makes a single pass counting base frequencies until one of them
reaches its threshold, then decrements every type's countdown by the frequencies
observed. One pass over the sequence, however many groups the tag has.

`getModPositions` restarts `currPos = 0` for each group and walks the sequence
again, because each group counts occurrences of its own canonical base. A
Fiber-seq read with `C+m` and `A+a` therefore walks its sequence **twice** where
htslib walks it once — and `modPhases.bench.ts` puts that walk's phase at 46% of
the per-read pipeline.

The same doubling applies one layer down: `forEachMaxProbMod` runs one CIGAR walk
per group, so a two-group read walks the CIGAR twice as well. Both are in
[TODO.md](../TODO.md) under "Walk the CIGAR once for a read's whole MM tag".

**And it is the reason to be careful with the `indexOf` idea.** Replacing the
per-base delta walk with `indexOf` jumps measures 1.42x on this corpus
(`seqscan.probe.ts`) — but this corpus is single-group. htslib's per-base scan is
a deliberate choice for the multi-type case: a single-character search cannot
count several canonical bases at once, so the two optimizations are alternatives
rather than complements. With one group, jumping wins. With several, one shared
per-base pass may beat N jumping passes. Nothing here can say where the crossover
is, because no fixture in either corpus has more than one group.

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
