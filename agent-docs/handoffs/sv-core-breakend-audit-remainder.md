---
name: sv-core-breakend-audit-remainder
description: Three findings from the sv-core breakend audit are fixed and revert-checked on an unlanded branch — the paired-adapter junction gap, the STAR-Fusion colon triple and the refName-case grouping bug, the last now SETTLED against the real COLO829 VCF rather than inferred — and what is left is landing the branch and one out-of-scope line in SpreadsheetModel that is the only place the outward breakend walk is fully fixable.
---

# sv-core breakend audit: the remaining three findings

Branch **`worktree-agent-acfeb70cb2f804a37`**, four commits, rebased on
`4575e15149`, tree clean. Nothing is landed.

## Land it

In the worktree, then from the primary checkout — `git -C` at the primary is
refused from inside a worktree session, so `ExitWorktree` with `keep` first:

```
git rebase main                                  # in the worktree
ExitWorktree keep                                # then, in the primary checkout:
git merge --ff-only worktree-agent-acfeb70cb2f804a37
git worktree remove .claude/worktrees/agent-acfeb70cb2f804a37
git branch -d worktree-agent-acfeb70cb2f804a37
```

```
42dbac0925 fix(bed): a STAR-Fusion breakpoint's refName may contain colons
e02fe752d3 fix(breakpoint-split-view): a reciprocal BND pair may spell one contig two ways
b75ecc286b fix(sv-core): a junction may come from a paired record, not only an ALT
d2f00b09d9 docs(sv-core): the two keeps-directions read their strings with opposite polarity
```

Green at the tip: jest over sv-core / bed / breakpoint-split-view / sv-inspector
/ spreadsheet-view / variants (1306), `typecheck`, `lint`, `lint:eslint`,
`check-format`, `check-docs`, `build:esm` on all three touched packages.

## The `breakendTickPx` interaction, corrected

`b2eefa40a9` ("a breakend tick is a genomic direction spent in screen space")
did **not** land mid-run — `git merge-base --is-ancestor b2eefa40a9 42dbac0925`
passes, so `breakendTickPx` and `breakendKeepsDirections` were already in
`util.ts` at the branch point and everything here is written against them. The
one real interaction is commit `d2f00b09d9`, which rewrites
`breakendKeepsDirections`'s docstring; it is an `#api` docstring, so `pnpm
autogen` output for `packages/sv-core/README.md` and
`website/docs/api/sv-core.md` is committed alongside. Anyone rebasing a parallel
branch that also touches that docstring should regenerate rather than merge.

## Finding 1 — the outward walk, and why the fix is where it is

**Reproduced.** `findJunctionsNear` modelled on the RPC (own-locus match only)
over `chr1 -j1- chr2 -j2- chr3 -j3- chr4`, one record per junction: **4 / 3 / 2**
stops from `j1` / `j2` / `j3`. With reciprocal records, all six give 4. The
audit's numbers are exact.

**The decision a reader will second-guess: I fixed the query side, and only the
half of it that is fixable.** The walk cannot invent a record, so the walk side
was never a candidate. But the RPC query cannot be widened either, and that is
the part worth not re-deriving: a BND feature's interval is `start + REF.length`
(`plugins/variants/src/VcfFeature/util.ts:56`, with `<TRA>` explicitly excluded
from the spanning branch), so it is ~1bp and no chr2 query can reach a record
filed at chr1. Finding a record by its **mate** coordinate is a scan of the whole
callset, and `makeFindJunctionsNear` runs against whatever adapter a variant
display holds — a somatic SV VCF is a few hundred records, a germline one is tens
of millions, and an `adapterConfig` carries nothing to tell them apart. So a
chain through a filtered VCF or a one-record `<TRA>` ends early rather than
wrongly, and that is now stated in `makeFindJunctionsNear`'s docstring instead of
being a silent limit.

**What the audit did not name, and what I actually fixed.** The working pattern
is already in the tree: `buildPairedIntervalTree` (`plugins/bed/src/adapterUtil.ts:26`)
files each bedpe / STAR-Fusion row under **both** contigs and emits a feature
anchored at whichever end was queried, with `mate` naming the other — literally
"a record whose MATE lands in the window comes back too". `junctionFromFeature`
read only the ALT and returned `undefined` for every one of them, plain and
`<TRA>`-typed alike, while `svMateLocus` in the same file handled both. So the
chain walk on bedpe and STAR-Fusion was not one-directional, it **found zero
junctions**. `junctionFromFeature` now goes through `svMateLocus`.

**Revert-checked.** Restoring the ALT-only read fails the new paired-feature
test (`Received: undefined`). Pinned by a fixture with no reciprocal records —
three rows, two features each as the adapter emits them, queried own-locus only,
all four loci from either half of any row — plus a characterization test holding
the 4/3/2 RPC-shaped limit so nobody "fixes" the walk.

## Finding 2 — the STAR-Fusion colon triple

**Reproduced.** `'HLA-A*01:01:01:01:5000:+'.split(':')` gives refName
`HLA-A*01`, start `1`, end `2`, strand `undefined`. The interval-tree bucket key
(`split(':', 1)[0]`) had it too, which the audit did not mention — a row filed
under a bucket no query can reach.

**Changed.** `parseBreakpoint` pops strand then position off the right; fewer
than three fields parses exactly as before. The bucket key goes through
`parseBreakpoint`. HLA row added to the fixture. **Revert-checked: 2 tests fail.**

**The tick-direction question is answered: they agree, and no shared helper.**
`breakendKeepsDirections('N[chr2:2000[')` is `{joinDirection: -1, mateDirection: 1}`;
that ALT is a `+`-donor / `+`-acceptor fusion and `tickDirection` gives donor
`-1`, acceptor `+1`. `util.test.ts`'s `TICK_FORMS` already pins all four ALT
forms independently of the implementation. A helper is not warranted — the two
take different inputs (a strand plus a role vs. a parsed `Breakend`) and have one
caller each. What was wrong was only the prose: the docstring claimed **both**
fields are "the negation of the string they read", and only `joinDirection` is
(`MateDirection: 'right'` already names the direction the mate keeps). Fixed in
`d2f00b09d9`.

## Finding 3 — SETTLED, not inferred

**The case difference is real, confirmed against the real file** at
`/home/cdiesh/fusion_demo_build/demo/COLO829.somatic-sv.vcf.gz`. The
transcription in `walkBreakendChain.test.ts` is faithful: `##contig=<ID=chr3>`
and the CHROM column are lowercase, the ALT bracket is uppercase, and **all 66
BND records in the file do it** (the other 102 are symbolic, no bracket). This
is the shipped cancer_sv demo.

The two keys came out `CHR10:58717464\tchr3:25359568` and
`CHR3:25359568\tchr10:58717464` — different buckets, `multi()` drops both, and
`Breakends.tsx:23` returns `[]` when `findMatchingAlt` misses. Two panels, no
curve, no error.

**Changed.** `breakendLocKey` in `packages/sv-core/src/util.ts` (case-fold, the
same fallback `getCanonicalRefName2` makes via `lowerCaseRefNameAliases`), and
both `getMatchedBreakendFeatures` and `findMatchingAlt` key through it. It lives
in sv-core because the eager/lazy boundary forbids `overlayGeometry.ts`
importing `featureMatching.ts`, and both already import from `@jbrowse/sv-core`.
`chr10` against `10` still needs an assembly, which neither caller has — said in
the docstring. **Revert-checked: neutering `breakendLocKey` fails both new
tests.** `reference/SV_MULTIHOP.md` named this open and is **updated**; it no
longer needs revisiting.

## What is left

1. **Land the branch.** Nothing in it is waiting on anything.
2. **The one line I could not touch** —
   `plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetModel.tsx:236-241`.
   The SV inspector's own `findJunctionsNear` applies the same own-locus-only
   filter over `svJunctions`, which is the whole callset already parsed in
   memory, so matching on either end is free. **This is the only place Finding 1
   is fully fixable**, and the SV inspector prefers this path over the adapter:
   with the branch landed a bedpe sheet goes from zero junctions to a working
   forward walk, and that line makes it bidirectional. Out of scope for this
   session (the brief said not to touch other plugins), not out of scope for the
   next one. `BedpeImport` holds one row per line with a `mate`, so nothing else
   is needed.

Nothing else was left half-done.
