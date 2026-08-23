---
name: walk-the-cigar-once-for-a-reads-whole-mm-tag-not-once-per-group
description: the same-base half shipped; what is left is worth ~1.1x and is Fiber-seq only
metadata:
  area: alignments, perf
  category: measure-first
---

# Walk the CIGAR once for a read's whole MM tag, not once per group

`forEachMaxProbMod` groups mod entries by positions-array identity, so entries
holding the same array share one CIGAR walk — the types of a combined code
(`C+mh`), and since the same-base merge, two groups like `C+h?;C+m?` as well.
**Entries from groups on DIFFERENT canonical bases never share one, and cannot**
— `C+m,…;A+a,…` is 5mC on cytosine and 6mA on adenine, so the two groups
genuinely have different positions. Such a read walks the same `ops` array twice.

Both walks are ascending, so they merge: hold one cursor per group, take the
minimum each step, walk the ops once. That turns O(N x ops + total positions)
into O(ops + total positions).

**Do not expect much from it, and this entry used to.** It claimed close to a
halving of the walk phase, reasoning that the ops term dominates (6.25M ops
against 0.84M positions). `cigarOpDensity.bench.ts` refutes it: sweeping op
density across a 5,000x range moves the walk's ratio between 1.10x and 1.18x,
because the phase is bound by per-CALL work — the 0.84M callbacks and the byte
lookups, comparisons and writes inside them — rather than by traversal. Merging
removes one ops traversal and none of the per-call work, so on this fixture it is
worth about the 5-10% that removing all the ops was, and on a low-op-density read
close to nothing.

**Two measurements have now said that from opposite directions**, which is worth
trusting more than either alone: the same-base merge shares a CIGAR walk and a
sequence walk in the same change, and splitting its number gives 1.08x for the
CIGAR half against 1.27x for the sequence half.

**This is not the exotic case.** Fiber-seq reads carry 5mC and 6mA as a matter of
course, and `modificationsMenu` already tells users that basecallers increasingly
emit several types per read. A combined code is the *rarer* shape; two groups on
one base is what dorado actually emits.

**The same-base half of this SHIPPED, and it took most of the entry with it.**
`C+h?` and `C+m?` are two groups on the same canonical base with equal delta
lists, which is what dorado emits, so `getModPositions` now compares the delta
text at parse time and hands both groups one positions array —
`sameBaseMerge.bench.ts`, 1.268x on the parse and 1.222x on the per-read
pipeline, free on every fixture where it cannot fire. What is below is what
survived that.

**The one-pass sequence walk is now a Fiber-seq optimization, and only that.**
Remeasured against the merged baseline, `multiGroupParse.bench.ts` makes htslib's
shape a **loss** below three DISTINCT groups: 0.917x at one, 0.930x at two
synthesized (`--groups=2`), 0.949x at the two real ones of the ONT fixture, and
1.385x only at fiberseq's 2.86. `A+a.;C+h?;C+m?` is three groups but two distinct
walks, so the 1.13x this entry used to quote was consumed by the merge rather
than left on the table. If it is built anyway, for `C+m;A+a;T-a`-shaped data:

- **Branch on the DISTINCT count, never the group count.** Counting duplicates
  puts the ONT case on the losing side of the branch.
- **An MM tag may ask for more of a base than the read has left, and the two
  shapes disagreed there.** `getModPositions` clamps to the nearest valid index
  for that call and every one after it; the one-pass arm dropped them, and its
  "output identical" rows only ever meant that no read in those fixtures
  overran. Get this from
  [reference/MODIFICATION_TAGS.md](../reference/MODIFICATION_TAGS.md) rather than
  from memory — the clamp rule was written down wrong twice, including in this
  entry, because until it was fixed only the FIRST unplaceable call landed in
  range.

**The CIGAR half across DIFFERENT bases is what is genuinely still open**, and it
is the part with no fixture argument against it: `A+a` and `C+m` have different
positions by construction, so no parse-time merge can fold them and
`forEachMaxProbMod` walks the ops twice. Hold one cursor per group, take the
minimum each step. Expect **~1.1x on that phase and no more** — `cigarOpDensity`
puts it at 1.10-1.18x across a 5,000x op-density sweep because the phase is bound
by per-call work, and the same-base merge just measured the same thing from the
other side: sharing a CIGAR walk was 1.08x where sharing the sequence walk was
1.27x.

Keep the identity grouping when doing this — it answers a different question
(which entries are the same walk) and any merge is a layer above it.
