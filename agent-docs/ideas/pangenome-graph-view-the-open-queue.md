---
name: pangenome-graph-view-the-open-queue
description: Nine open items for the graph view, three of which unblock the rest — taking `scaleX`/`translateX` from the connected LGV (which is `hprc_mhc_anchored`'s whole argument), following that view's region so the window is navigable from inside, and picking a tier by `bpPerPx` with expand-on-click. Also why the anisotropy must NOT go in the transform uniform, and why the reference-only index does not kill the 12 s fetch. The view itself lives in the out-of-tree GraphGenomeView plugin.
---

# Pangenome graph view: the open queue

Moved out of [TODO.md](../TODO.md) on 2026-08-26. It is a queue rather than an
item, and the code it plans lives in another repo — so it reads as a roadmap for
whoever picks that plugin up, not as work in this backlog.

Read [reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) first — the
files, the measured costs and the decisions that look like bugs are all there.
**Take them in this order**, because three of them unblock the others.

**1. The graph takes `scaleX`/`translateX` from the connected LGV.** When
`connectedViewId` is set, read `bpPerPx`/`offsetPx` from that view. y-in-px
shipped, so this is a change to x alone. It is what `hprc_mhc_anchored` needs —
that figure's whole argument is a shared axis, and today the segments lane spans
the full pane while the backbone starts after `FIT_PADDING` (40) plus the
row-label gutter. Sharing a coordinate system is not sharing a pixel mapping.

Not to re-derive: **the anisotropy does not belong in the transform uniform**,
even though the uniform has carried `scaleX`/`scaleY` all along. Most of the
drawing mixes the axes in a single `hypot` — a chord length, a tangent
projection, a deletion's bow, a mitred normal, an arrowhead's angle, a hover
distance — and each is nonsense the moment x is bp and y is px, so the conversion
(`yToX = scaleY/scaleX`) has to happen where the geometry is built.
`geometry.test.ts` asserts `yToX === 1` is the *identity*, not merely close,
which is what keeps the committed FMMM figures byte-stable.

**2. Follow that view's region, so the window is navigable from inside.**
`loadedRegion` is written once by the launch and no action changes it
(`refetchIfNeeded` returns early when `self.graph` is set), so seeing the next
60 kb means going back to the linear view and rubber-banding again. Fetch cost
does not scale with window size (~1.3 s, dominated by HTTP setup). Once item 1 is
reading the transform, this is a debounced refetch when the region leaves
`loadedRegion`, under `MAX_GRAPH_REGION_BP` with the existing "zoom in to view
graph" message past it. A locstring field plus widen/narrow buttons is the
fallback if following fights the user.

**3. The view picks a tier by `bpPerPx`**, the way
[SYNTENY_LOD.md](../reference/SYNTENY_LOD.md)'s two PIF tiers already do — config is
a prefix per tier plus its bp range, and there is no new rendering mode. Then
**expand-on-click** (PangyPlot's `/pop`): the tier node id *is* the bubble's
source segment, so expanding is a fine-index query over the same span with no
cross-reference to maintain. This retires `maxRegionBp`, which is the interim
mechanism.

Then, in no particular order:

- **Draw a node once per carrier.** `sampleRowLayout` emits one position per node
  id and the renderer keys geometry by that id, so real multi-row carriage needs
  synthetic per-carrier ids plus hit detection resolving them back.
- **Let a row set be requested.** Rows come from whoever contributed to the
  window, so a graph cannot be lined up row-for-row with a genotype matrix of
  chosen donors — which is what a graph-beside-callset figure like
  `hprc_graph_vs_callset` wants. The design ask is real; the pointer this used to
  carry is not, since that figure's review verdict is `good` and
  `screenshot-review.json` holds no `open` statuses at all.
  An explicit list of samples to row (empty rows included) would make the two
  panels comparable, pin the order across windows, and let the graph label
  `HG00642.1` where the callset labels `HG00642 HP0`.
- **Kill the 12 s `fetch`.** The reference-only index was built and does *not* buy
  it: `subgraphContext` defaults to **1 hop**, and a hop follows allele interiors,
  which are indexed under exactly the donor contigs the small pair drops — so
  pointing the graph cut at it silently returns the context-0 graph with no error
  to notice (measured on C4: context 0 agrees at 30/36, context 1 and 2 differ).
  The small pair is for a segments track drawn on the reference. What would
  actually do it is making the hop reach donor rows without indexing every donor
  contig — a third small file keyed by segment id for allele interiors, or a link
  row carrying enough interior that no second query is needed. Producer plus
  adapter change, not a config swap.
- **Regenerate the graph figures, if a pitch change is still owed.**
  `ROW_HEIGHT_PX` has no trace in this repo, and every graph figure has been
  republished at least twice since this was written (`fd707c4bff`, `82b3cdcde8`),
  heights dropping the way a row-pitch change would — so read one against the
  plugin before rendering anything. If it IS owed, the change moves every
  anchored figure by design, which is exactly why it must not go out piecemeal.
- **`graph.slang` would stretch every stroke's half-width by `scaleY/scaleX` on a
  row layout.** Dead code today — `createGraphRenderer` returns Canvas2D
  unconditionally — but `GraphRenderer.ts` states the one-token fix for whoever
  lands a GPU backend.
- **Launch the graph view from a clicked segment.** The data side is ready:
  `links.bed` states both endpoints in full, precisely so a reference segment can
  reach an off-reference neighbour. The affordance belongs in the plugin repo.
