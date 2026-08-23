---
name: coarsen-a-graph-loaded-as-a-file-collapse-trivial-bubbles
description: designed; path lanes are the open question
metadata:
  area: pangenome
  category: ready
---

# Coarsen a graph loaded as a FILE: collapse trivial bubbles

Designed, not built. The tier route above does not reach this case: a tier is a
hosted segs/links pair, and a figure like `pangenome/pggb_haplotype_paths` loads
a GFA through `gfaLocation` because the tabix cut has no P lines and `drawPaths`
would have nothing to draw. A file has no tier to switch to, so its coarsening
has to happen in the view.

**The complaint is arithmetic, not taste.** `ecoli_pggb_is5.gfa` is 20 segments /
26 links / 5 paths over 1,414 bp, and twelve of the twenty segments are 1 bp. The
figure runs `bubbleSpread: 'open'`, whose floor is `2.5 * MEAN_NODE_LENGTH` = 100
FMMM units, and `bandageAutoScale` puts this graph at 0.566 units/bp — so
everything under 177 bp clamps, which is nineteen of the twenty nodes. Drawn
length is 19 × 100 + 678 for the 1,199 bp IS5 arm = 2,578 units, of which the
twelve 1 bp alleles hold **47% while carrying 0.8% of the sequence**, and the arm
the figure is about holds 26% while carrying 85%.

**The shipped levers cannot fix it**, which is why this is a mechanism and not a
spec edit: `auto` draws the alleles proportionally, as specks with no length for
a path lane to run along — the thing the floor was added for — and `compress`
pulls the arm toward the mean and piles its five ribbons into colour confetti.
Both were rendered and rejected; what each of the four shipped spreads is an
instrument for is `website/docs/user_guides/graph_genome_view.md:268-288`, and the
review notes are in `0c432e1141`. The fourth, `wide`, is untried here and is not
worth trying: it is `open`'s floor lifted higher, so it clamps the same nineteen
nodes, which is the arithmetic above rather than a matter of taste.

**Collapse the bubble, and that is what lets the floor come off.** The two are
one change: the floor exists only to give a bubble's ARMS room to separate, and a
collapsed bubble has no arms. With both, this graph is 13 nodes at 0.368
units/bp, the IS5 arm at 441 units against 79 for everything else — the arm
becomes 85% of the drawn length, which is its share of the sequence.

In build order:

- **A pure pass over `Graph`, after parse and before layout.** Not a renderer
  change: a collapsed bubble already satisfies the segs contract (a reference
  span, an id, a rank). `collapseTrivialBubbles(graph, { maxAlleleBp })`
  returning a new graph plus the map from collapsed id to the nodes behind it.
- **Detection without BubbleGun.** The singleton-arm case is the one that matters
  and is a local test: a source with k > 1 out-links to distinct nodes, each with
  exactly one in and one out, all converging on one sink, every arm under
  `maxAlleleBp`. In this file that catches four of the six bubbles; the fifth is
  a nested superbubble needing the real algorithm, and the sixth is the IS5 event
  itself, which must NOT collapse — `maxAlleleBp` handles that on its own.
- **The floor becomes conditional on there being arms.** A `bubbleSpread` floor
  applied to a collapsed node is the same bug one level down.
- **Path lanes are the open question, and why this figure is the test case.**
  Every path traverses a collapsed unit, so lanes drawn the current way say "all
  five carry it" — the exact opposite of the carriage claim the figure exists
  for. Worth building: colour the collapsed node's lanes by WHICH allele each
  path took, which says strictly more than the picture does today. The fallback,
  suppressing collapsing while `drawPaths` is on, leaves this figure as it is and
  buys nothing.
- **Expand on click**, as above. For a file-loaded graph the arms are already in
  memory, so it is view state rather than a fetch — cheaper here than on the tier
  route.

Two findings already paid for, so they are not re-priced: **chain contraction is
the wrong primitive** (`vg mod -u` measured at 0.95% on HPRC chr20, because at 90
haplotypes almost no node has bidirected degree 2 — the number is
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md):661-663, which
credits an `adr-014` that does not exist), and
**BubbleGun as published does not reach human chr1** (the PangyPlot team measured
chrY 2 s / 1 GB, chrX 30 s / 11 GB, chr9 ~40 min / 13 GB, chr1 hanging at
15+ GB). PangyPlot's second mechanism — merging degree-2 runs into polylines and
grid-snapping — does not apply either: on chrY hprc.clip 39.4% of segments are
junctions and the mean linear run is 2.8 segments, so RDP tops out at 59.5% and
only grid snapping reaches 99%. That is a layout-space simplification for an
overview, not something that makes one 20-node window legible.
