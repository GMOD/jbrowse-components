---
name: split-read-chains
description: How a split read is put back together from the SA tags of the segments that were fetched — the read-order axis every consumer sorts on, the dedup key that separates two passes over one locus, what happens to a segment no view fetched, and why a per-region answer about a chain is an answer about the region. Read before joining alignment records into a chain, before deriving a field from what one fetch saw, or before dropping a segment nothing returned.
---

# Putting a split read back together

A BAM fetch returns **alignment records**. What a reader is looking at is a
**read** — one molecule that the aligner cut into segments and filed separately.
A read that leaves chr3, hops through chr10 and chr12 and comes back to chr3
inverted arrives as four records, in up to four different fetches, and each one
carries an `SA` tag listing *the read's other alignments*. So any one record
describes the whole read, and that redundancy is the subject of this doc: it is
what makes the chain reconstructible at all, and it is where every bug in the
reconstruction comes from.

This repo does the same join four times, in four vocabularies — SA tags, mate
flags, VCF breakend ALTs, bedpe/fusion halves — and the seven rules below are
what the four have in common. They are collected here rather than in one
plugin's notes because a mistake in any of them produces a picture that is
confident, plausible and wrong.

**The idea outside the genomics** is on the last section, in one paragraph: a
range-addressed store whose rows point at rows the range cannot reach. That is
the whole of what transfers, and everything before it is stated in reads and
segments because that is what the code says.

## 1. A chain is keyed by read name, never by a number a fetch minted

Chain numbering is per worker call, so the same read gets a different chain index
from every region that sees it. **Anything unioning chains across calls keys on
the read NAME** —
[RenderAlignmentDataRPC/CLAUDE.md](../../plugins/alignments/src/RenderAlignmentDataRPC/CLAUDE.md)
states it, `mergeChains` lays rows out by it, and `reconcileChainSuppAcrossRegions`
re-answers a fill by it.

The two failures live at the edges of "name":

- **A feature with no name joins nothing, rather than joining everything.** A
  PAF/synteny block carries no QNAME, and the empty-string bucket made every
  block in the region one chain the moment `linkedReads` was set.
  `chainGroupingKey` and `groupReadsByName`
  (`plugins/alignments/src/features/arcs/arcChains.ts`) both skip a nameless
  feature, and that skip is the rule rather than a guard.
- **A secondary alignment shares the name and is not part of the chain.** It is
  another placement of the same read, not another piece of it, so
  `chainGroupingKey` mints it a unique synthetic key and a multimapper never
  joins its primary's chain.

## 2. Every segment goes onto the read's own axis before anything is compared

Genomic order is not read order: across an inversion the two disagree, and a
chain sorted by genomic start chains the wrong two segments together. So every
consumer that walks a chain first puts each segment at its offset along the read
— `clipLengthAtStartOfRead`, from `getClip` — and sorts on that.

**Which frame that offset is measured in has to be decided at the call site,
because there are two.** `featurizeSA`
(`packages/cigar-utils/src/mismatchParser.ts`) takes a `normalize` flag: the
read-vs-ref launchers want every segment in the query's reference orientation,
the arc and chain walks want each segment's raw mapping strand. The record the
tag was read *off* then has to be measured in whichever frame its SA entries
were put in — `buildReadVsRefFeatures` calls `getClip(cigar, 1)` and not
`getClip(cigar, strand)` for exactly that reason. Measuring it in the read's own
5'→3' frame reads the clip off the far end of a reverse-strand CIGAR, which
drops the primary into the wrong place along the read and mis-sorts the
segments.

**A missing clip is not a clip of zero.** `getClipLengthAtStartOfRead`
(`plugins/breakpoint-split-view/src/BreakpointSplitView/featureMatching.ts`)
derives the offset from the CIGAR when the adapter did not supply it, because
otherwise every segment collapses to 0 and the read-order sort silently becomes
a no-op — a pipeline that still runs, over an unordered chain.

## 3. The SA tags repeat, and the dedup happens before the CIGAR parse

Each segment's SA tag lists the read's *other* alignments, so an n-segment read
describes each of its alignments n−1 times and a naive walk parses the same text
O(n²) times. The fix is to dedupe the entries **as text**: `splitSA` yields the
raw `;`-delimited records, the caller drops the ones it has already seen, and
`featurizeSAEntries` parses what survives. `readChainSegments`
(`featureMatching.ts`) does that and pays O(n) CIGAR parses; `featurizeSAEntries`
exists as a separate export from `featurizeSA` only because a filter cannot be
applied behind a single-string parameter.

Same rule one level up, and it is why both walks spell it this way:
`getTag(feature, 'SA')`, never `feature.get('tags')`, which decodes every tag on
the read to answer one presence check — per segment, of every chained read on
screen.

## 4. A segment's identity within a read is its locus AND its read position

A segment reaches the chain builder twice: once as a record some region fetched,
once as an entry in another segment's SA tag. Collapsing the two needs a key,
and **the locus alone is not it.**

`segLocusKey` (`arcChains.ts`) is refName + start + clip-at-start-of-read. On
refName + start alone it also folds together the *passes* of a read that
traverses one locus more than once — which ecDNA and rolling-circle reads do,
so the circle-closing junction vanished while the read still counted as support
for a linear allele it does not describe, and a one-segment circle read's chain
dropped outright. The read position separates the passes, and both descriptions
of a segment agree on it because both derive the same strand-corrected clip from
the same CIGAR, S and H alike.

Two preconditions ride with that key, and they are the reason it is sound:
every segment's refName is canonical (SA segments are normalized in
`saSegments`), and `readPositions` carries the read's TRUE start rather than one
clipped to the region — a clipped start never matches its SA twin's, leaving
both copies in the chain to be joined as a spurious same-strand deletion.

The mirror case is one physical read returned by two overlapping fetches, e.g.
spanning collapsed-intron exons. `dedupeByReadId`
(`plugins/alignments/src/shared/readGroupConnections.ts`) collapses those on the
record id, because two copies of one record look exactly like a two-segment
split read and `splitJunctions` fabricates a junction from a read to itself.

## 5. A segment no view fetched still exists, and its absence is a value

The SA tags name segments the fetch did not return. Walking only the fetched
segments and joining each to the next is the natural implementation, and it is
the one that produced the sharpest bug here: a read leaving chr3, hopping chr10
and chr12 and returning inverted drew **one solid junction between its two chr3
arms — a false inversion indistinguishable from a real one**, in exactly the
view (chr3 alone, both arms visible) that fetches both ends and neither hop.
Fixed in `68eab1e8c7`.

There are two right answers and the choice is per consumer:

- **A connector draws the junction and marks it.** `splitJunctions`
  (`readGroupConnections.ts`) and `markHiddenSegments` (`featureMatching.ts`)
  each emit the junction, count the read's own segments lying strictly between
  the two on-screen ones, and pass the loci up — which the overlay draws dashed
  and names in its hover. A reader following one molecule loses the thread if
  the connector disappears.
- **An aggregate emits nothing.** `unpairedChainArcs` withholds the junction,
  because in a band whose marks are being counted a wrong junction becomes
  evidence.

Either way the gap is carried as a field (`hiddenSegmentsBetween`,
`hiddenSegmentsBefore`) rather than being the silence left by a `continue`. The
same-strand case is still open:
[a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid](../todo/a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid.md).

## 6. A per-region answer about a chain is an answer about the region

The most expensive rule here, because the per-region answer is never *wrong* —
it is correctly about the wrong subject.

The worker marks each chain per region: does it carry a supplementary segment,
and which way does its primary point. **A chain crossing a region boundary is
exactly the case where no region holds the whole chain**, and an
interchromosomal fusion — one window on chr22, one on chr9 — is the shape chain
mode exists for. So one molecule was classified twice, differently, and neither
answer was about the molecule: the chr22 side saw no supplementary and painted
the scheme's plain fill, the chr9 side saw no primary and framed its segment
against the unknown-primary fallback while the legend said "inverted relative to
the chain's primary". `reconcileChainSuppAcrossRegions`
(`plugins/alignments/src/LinearAlignmentsDisplay/chainSuppAcrossRegions.ts`)
re-answers both bits from the union of the regions, keyed by name per rule 1.

`consensusChainStrandFrames`
(`plugins/alignments/src/LinearAlignmentsDisplay/chainStrandConsensus.ts`) is the
harder version of the same thing: **which segment of a read is flagged primary
is arbitrary on a foldback**, so the answer does not exist inside any one chain
and no amount of per-chain care produces it. It is settled on the main thread by
a vote across every chain on screen, and the pass sweeps until nothing flips.

Two mechanics that make a re-answer possible at all, both worth copying:

- **The encoding has to leave room to replace half an answer.** These bits were
  an 0–4 enum where a split marker occupied the same value space as the field
  being recomputed, so a split read had to be skipped whole. As a bit field with
  `CHAIN_SPLIT_MASK`, the union re-answers the has-supp and frame bits and ORs
  the read's own split bits back in.
- **The per-region producer and the reconciler share one encoder.**
  `chainSuppFill` (`plugins/alignments/src/shared/buildChainMetadata.ts`) is
  exported for that reason: the union has to encode the answer *the same way*,
  not the same way again.

## 7. Two features that point at each other need a key that sorts

Where the join is a mutual pointer rather than a list — a VCF breakend naming
its mate position, a bedpe or STAR-Fusion record arriving as two halves each
carrying `mate` — the key has to come out identical computed from either side.
It is one line, the unordered pair sorted and joined, and
`getMatchedBreakendFeatures` and `getMatchedPairedFeatures`
(`featureMatching.ts`) both use it.

**What it replaces is the adapter's own uniqueId**, and that is the failure
worth carrying: the halves are minted `<prefix>-<refName>-<index>-r1|r2`, where
the index counts within that refName's bucket, so the two halves of one record
disagree on *both* fields — stripping the `-r1`/`-r2` suffix neither rejoins a
real pair nor keeps unrelated ones apart. Rule 1 again, one level down.

The smaller version sits in the same file: `getBadlyPairedAlignments` keys its
"already seen at this position" set on read name *and* span. On span alone it
also dropped unrelated reads that happened to share a span, silently losing
their mate's connection and making the result depend on iteration order.

## The four joins, side by side

`featureMatching.ts` holds all four, which is what makes them legible as one
thing rather than four coincidences:

| what is being rejoined | how a feature names its other half | rejoined by |
| --- | --- | --- |
| a split read | `SA`, the read's other alignments | `unpairedReadChain`, `readChainSegments` |
| a read pair | the mate's placement in the read's own flags | `resolveReadGroup`'s mate partition |
| a VCF adjacency | the mate position inside the breakend `ALT` | `getMatchedBreakendFeatures` |
| a bedpe / fusion record | a `mate` on each half | `getMatchedPairedFeatures` |

The first two are the list form, the last two the mutual-pointer form. Rules 1
and 4 through 6 apply to both.

## Before reaching for any of this

**If the fetch can return the whole thing, let it.** None of these rules is a
technique to adopt; they are what a range-addressed file format forces when a
read extends outside any range you could ask for. The tell is precisely that the
record names a piece the query *cannot be widened* to include, because it is on
another chromosome.

Where that does not hold, the same seven rules are pure cost: a name-keyed union
over data the fetch could have joined, a reconciliation pass over windows that
need not have existed, and the redundancy tax of rule 3 paid for nothing.

## Depth lives elsewhere

- The reconstruction built on top of these chains, and its own rules:
  [derivative-allele-candidates](derivative-allele-candidates.md).
- What a chain's colour then means, and which rule outranks which:
  [alignments-decision-tree](alignments-decision-tree.md).
- The measurements, and the offline tool that answers the same question from a
  callset: [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md).
- What is still parked in this feature area:
  [ideas/sa-hops-in-the-bezier-overlay.md](../ideas/sa-hops-in-the-bezier-overlay.md).

## What travels

Strip the genomics and this is a store addressed by range whose rows point at
rows the range cannot reach — distributed spans naming a parent in another
trace window, log lines carrying a next-hop, chunked uploads that each name the
rest of the upload. The rules survive the trip in this order: **the entity's id is a name,
not an index the query minted** (1); **a row that arrives twice needs a dedup key
unique within the entity, not within the world** (4); **anything derived from
"what this query saw" is a fact about the query** (6); and the one to lead with,
because every reader has shipped it — **a gap you closed silently looks exactly
like real structure** (5). Framing and audience:
[ideas/upstreamable-ideas.md](../ideas/upstreamable-ideas.md).
