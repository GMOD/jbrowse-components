# Pangenome figures — open work (2026-07-26)

Two `bad` verdicts in `website/scripts/screenshot-review.json` are still open,
both asking for the same thing: make a GraphGenomeView panel and the linear
panel beside it read as one picture. Neither was touched in this session because
a second agent was working `website/scripts/specs/graph.ts` at the same time
(see "In-flight work in the tree" below). This is the analysis so whoever picks
them up does not have to redo it.

The pattern that worked for the third such figure is
`pangenome_cactus/graph_correspondence`: find a quantity or a category BOTH
panels can paint, then paint it identically on both sides, sampling the colors
out of the other picture rather than guessing them. There, the graph half is a
committed `odgi viz` raster and the linear half became `odgi pav` rows in the
raster's own row order and colors. Same idea applies below.

## `pangenome/local_subgraph`

> "it would be great if we could get coloring on the linear genome view that
> matches up to the graphgenomeview viewer"

The figure is `chr:1,004,450-1,005,010`: an LGV of the pggb MAF (five rows) over
a GraphGenomeView of `ecoli_pggb_subgraph.gfa` with **Color: Depth**, which
draws one green branch and one yellow branch.

What the graph can be colored by is fixed by the plugin
(`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`,
`src/GraphGenomeView/colorSchemes.ts`): uniform, random, rainbow, depth,
node-length, stable-rank, grey. A pggb GFA carries no `SR` tags, so stable-rank
is out, and there is no per-path/per-sample scheme. **Depth is the only shared
quantity**, and JBrowse already has it as `ecoli_pggb_depth` (paths over K12),
so that is the track to put under the MAF.

Depth colors come from `DEPTH_GRADIENT` in
`src/GraphGenomeView/renderer/GeometryBuilder.ts`, viridis:

```
[68,1,84] [59,82,139] [33,145,140] [94,201,98] [253,231,37]
```

sampled at `(node.depth - minDepth) / (maxDepth - minDepth)` **over the loaded
subgraph**, not over an absolute scale. At this locus that is 5 paths, so the
yellow branch is "every path goes through here" and the green one is a node a
path leaves.

An exact viridis ramp is not reachable from wiggle config: `color` on a wiggle
is a single CSS color, explicitly not a jexl callback (it colors per signal, not
per feature — see the slot description in
`plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts`), and `density`
rendering is a white→one-hue ramp (`getDensityColor.ts`). What IS reachable is
the two colors the graph actually shows at this locus, via bicolor:

```js
{
  trackId: 'ecoli_pggb_depth',
  type: 'LinearWiggleDisplay',
  useBicolor: true,
  posColor: 'rgb(253,231,37)',   // viridis max = the graph's yellow backbone
  negColor: 'rgb(94,201,98)',    // the next stop down = the graph's green branch
  bicolorPivot: 4.5,             // 5 paths here; verify against the real values
  minScore: 0,
  maxScore: 5,
  height: 90,
}
```

Two things to check when you do it:

- `bicolorPivot` is also the bars' **origin** (`wiggleComponentUtils.ts` passes
  it as `origin`), so bars draw up from 4.5 for depth 5 and down from it for
  anything less. That reads well here (a green downward bar is "a path left the
  backbone") but it is a real change in what the plot looks like, so look at the
  PNG before believing the numbers.
- Read the actual depth values in the window first rather than trusting 4.5. If
  the subgraph's own min/max differ from the bigwig's values over the same
  window, say so in the caption instead of implying an exact mapping.

The track has to come in as a `sessionTracks` entry: the spec loads
`test_data/graphgenomeview/config.json`, which carries the K12 assembly and **no
tracks at all** (that is why the MAF is declared inline), so add a
`QuantitativeTrack` with
`https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_depth.bw` the same way.

## `pangenome/hprc_mhc_bandage`

> "can only see 'blue' in the hprc track. if the orange are 'nonreference' and
> cant be shown as segments in the linear genome, what should we do?"

The premise is right and it is structural, not a bug: `RgfaTabixAdapter` serves
segments by hg38 position, and a rank>0 segment has no hg38 position — it lives
on another assembly's refName. An hg38 lane of that track can therefore only
ever be the blue rank-0 backbone, no matter how it is colored. (The rank colors
themselves are already matched: `hprc.json`'s `hprc_minigraph_segments` carries
`color: jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'`, and
the graph's Stable rank scheme is rank 0 `rgb(52,152,219)` then a ramp from
`rgb(237,137,44)` at rank 1 to `rgb(158,42,122)` at the subgraph's max rank.)

So the question is what reference-anchored object stands in for the orange. Two
candidates, both already in `test_data/graphgenomeview/hprc.json`:

- **`hprc_minigraph_bubbles`** — the bubble is where the non-reference sequence
  attaches to the backbone. Painting it in the rank-1 orange makes "orange in
  the graph" and "orange interval in the linear panel" the same color, with the
  caption saying the linear view can show where the allele hangs off but not the
  allele itself.
- **`hprc_minigraph_alleles`** — the allele inventory (an AlignmentsTrack over
  the allele BED) draws each non-reference allele as an insertion marker at its
  insertion point, labelled with its bp. This is the closer answer to "what
  should we do": it is the non-reference sequence itself, anchored. The parallel
  session built a figure on it (`pangenome/hprc_allele_inventory`, still
  uncommitted), so check that first and consider whether the bandage figure
  should simply gain that lane rather than invent a third representation.

A per-allele track colored by rank is **not** reachable from config as things
stand: the bubbles BED carries no rank, and the rank>0 segments are on other
assemblies' refNames. Either add rank to the allele/bubble BED in
`scripts/build_rgfa_alleles.sh`, or state the limitation in the caption. Do not
fake it with a jexl over something that is not rank.

## In-flight work in the tree (do not duplicate, do not sweep)

As of this writing these are **uncommitted** in the shared worktree, from a
parallel session:

- `website/scripts/specs/graph.ts` (+~190 lines: `pangenome/hprc_allele_inventory`,
  `pangenome/hprc_graph_vs_callset`, pinned track heights on the bandage figure)
- `test_data/graphgenomeview/hprc.json`, `website/docs/tutorials/pangenome_hprc.md`,
  `scripts/build_rgfa_alleles.sh`, `scripts/build_hprc2_pclai.sh`
- new PNGs: `hprc_allele_inventory`, `hprc_graph_vs_callset`,
  `rgfa_hover_correspondence`, `rgfa_sample_rows`; modified `hprc_mhc_bandage`,
  `hprc_mhc_anchored`, `rgfa_segment_neighbourhood`

Commit with an explicit pathspec and leave those alone unless you are the one
who wrote them.

## Unrelated but pending: the launch-dialog figure

`multiway_synteny/ecoli_launch_dialog` (and the `_from_selection` stack it feeds)
was captured against the `products/jbrowse-web/build` that predates commit
`4c96431`, which reworked that dialog (anchor as a movable row, select all/none,
shared window-size field). It needs a `pnpm build` in `products/jbrowse-web`
followed by `--filter=ecoli_launch` to match what the tutorial now describes.
