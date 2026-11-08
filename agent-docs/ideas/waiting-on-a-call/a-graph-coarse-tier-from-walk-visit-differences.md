---
name: a-graph-coarse-tier-from-walk-visit-differences
description: A pairwise overview tier from a graph with no sequence compared, totalling node length by the difference in two walks' visit counts, measured on HPRC v2.1 loci; and why chaining shared nodes cannot give one at a copy-number locus.
---

# A graph coarse tier from walk visit differences

Measured on HPRC v2.1 windows; nothing is built. The open call is whether the
overview tier for graph-derived pairs is this bag of nodes, and how to draw it.

## Shared nodes assert under half of what aligns

On amylase (chr1:103,539,800-103,801,379, five haplotypes), NA18608#2 against
HG00232#1: the forward record matches 319,912 bases, only 148,110 of them on
nodes both walks visit (`ns:i:` in the reader's PAF). Chaining shared node
stretches alone is far faster (154 ms for the four adjacent pairs against
several seconds) but writes the whole array as one 207 kb insertion against a
301 kb deletion and loses every inversion record. `coarsenCigar` does not
recover it: `79506:79496M207384I301491D68728:68748M` against the true
`222135:222126M16217I16213D29387:29384M19153I113262D68728:68748M`.

So at a tandem array a coarse CIGAR has to come from comparing bases, then
coarsening. There, sketching the seeds is the lever (1 per ~8 bp held the
picture and ran ~2.4x faster; 1 per 64 bp broke the hardest pair), and chain
lookback is not (5,000 to 500 degraded structure; 50 ran slower).

## The proposal: total node length by visit difference

For two walks through a window, count each walk's visits per node and total
node length by the difference. No sequence is compared.

- **C4** (no loops; copy number is private sequence): all four adjacent pairs of
  the tutorial stack reproduce the documented biology: the 32.7 kb module
  GRCh38 lacks (32,857 bp at -1), the 6.4 kb HERV-K insertion (6,494 bp at -1),
  a one-module haplotype (32,822 bp at -1), and no difference between the two
  three-module rows. About 100 bp per row is SNP-sized private nodes.
- **HG01361#1 vs GRCh38#0** (no loops): 167,239 bp at 0 and 94,340 at +1,
  against the full alignment's 167,239 matched and a 94,204 bp deletion.
- **Amylase** (walks loop 2-4 times): the array splits into blocks near 29.4 kb
  and 17.6 kb that recur across independent pairs at different multiplicities,
  copy number a base alignment cannot express.

Cost: 28 ms for the four amylase pairs in pure Python, against ~3 s for the
base alignment, so the fetch of the walks becomes nearly all of the wait. It
replaces "one repeat unit times a traversal count", whose periods smear several
loops together.

**Limits.** A bag of nodes loses order and orientation, so an inversion on the
same nodes is invisible (amylase's sit on distinct nodes and show as present or
absent blocks). Drawing it needs each node's position along each walk layered
back on.

## Revisits say where the expensive pass is needed

Counting visits per node in one pass over a walk:

| window | walks | walks with a revisited node |
| --- | --- | --- |
| CFH | 7 | 0 |
| MICB | 11 | 0 |
| amylase | 5 | 3 (max 2, 3 and 4 visits) |

Where no walk revisits, an alignment with zero bases compared gives a coarse
CIGAR byte-identical to the base-compared one (3 of 3 CFH pairs, including an
84,684 bp indel; 4 of 4 MICB). Where one revisits, the cheap path fails over
exactly the revisit span: HG00232#1's span is 79,506-380,997 and the cheap
deletion is 301,491 bp, the span's width; HG00133#1's 113,260 bp span likewise.

## Routes measured and declined

- **BubbleGun bubble chains** are acyclic by construction: on amylase they cover
  22.8% of graph sequence, and the largest bubble indel is 1,008 bp against a
  real 113 kb. A tandem array is a cycle, not a bubble.
- **PangyPlot's multi-resolution skeleton** is a dyadic grid-snap of 2-D odgi
  layout coordinates, a drawing LOD with nothing to say about a linear
  alignment.
