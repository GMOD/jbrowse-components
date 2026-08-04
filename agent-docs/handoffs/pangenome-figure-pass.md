# Pangenome figure pass, 2026-07-28 (handoff)

State of an HPRC/pangenome screenshot pass. Everything below is **uncommitted**
in the working tree. Another agent was running `pnpm gendocs` during this work,
so `website/docs/config|models|api` may show as deleted in `git status` — that
is theirs, not this pass. Commit with an explicit pathspec.

## Files this pass touched

```
website/scripts/specs/graph.ts
website/scripts/specs/hprc2.ts
website/docs/tutorials/pangenome_hprc.md
website/scripts/screenshot-review.json      (fix notes appended, statuses left alone)
website/scripts/figure-manifest.json        (regenerated)
website/src/lib/galleryLinks.generated.ts   (regenerated)
website/static/img/hprc2/{local_ancestry,local_ancestry_clustered,mhc_clustered}.png
website/static/img/pangenome/hprc_{c4_subgraph,graph_vs_callset,lpa_kiv2,mhc_anchored,node_menu}.png
website/static/img/pangenome/rgfa_{subgraph_launch,sample_rows,hover_sync}.png
website/static/img/tutorial-thumbs/pangenome_hprc.webp
```

Checks run clean: `astro check` (0 errors), prettier, `pnpm check-docs`, and
`pnpm autogen --check`.

## Done

**`hprc2/local_ancestry` was published at the wrong window.** `b592c72585`
rewindowed the PCLAI painting to `chr1:210Mb-end`; `ac585558b3` recommitted this
one at whole chr1 while its clustered sibling kept the new window, so the
tutorial's before/after-clustering pair was two different regions. Re-rendered.
Nothing checks a PNG against its spec — see "Open" below.

**`pangenome/hprc_node_menu` is one frame now** (open review verdict: "make into
a single screenshot… where highlight and right click menu is visible"). The
actions click **Highlight in hg38**, then right-click the same node again, so
the menu sits over the band it left behind; the highlight persists, which is
what makes one frame possible. Gene lane compact at 60 px. 2470 → 1620 px tall.

**`hprcSegmentsLane` went to `heightMode: 'grow'`.** It packs 2-4 rows depending
on the window, and the pinned 45 px cut the last row against the lane border and
raised a scrollbar in *every* HPRC figure carrying it. `heightMode` is a real
config slot on `LinearBasicDisplay` (`plugins/canvas/.../baseConfigSchema.ts`)
and already has a spec-recipe click-path, so nothing else had to change.

**Bubbles lane off `hprc_mhc_anchored`.** At that window the class II bubble
spans the full width and five small ones pack against the right edge, where both
of their label lines are cut off *horizontally* — no height fixes that, and
`grow` made it worse (more whitespace, same truncation). The caption never read
the lane. C4 and LPA keep it, pinned, on windows where the labels fit.

**`hprc2/mhc_clustered` density.** Gene lane was on its default and spent 145 of
780 css px on five compact glyphs; the matrix ran 22 css px off the bottom
(the generator's own below-the-fold report). Gene 70, matrix 460 → 515, viewport
825.

**Two caption corrections on `hprc_graph_vs_callset`:** the graph rows only the
haplotypes that donated sequence (12, against the callset's 20), and the callset
numbers a donor HP0/HP1 where the graph uses PanSN `.1`/`.2`.

**Reference-position ("rainbow") colors on the E. coli correspondence figures**
— `rgfa_subgraph_launch`, `rgfa_sample_rows`, and `rgfa_hover_sync` (the last
shares `ecoliSampleRowsSession`). Two open review verdicts asked for this, and
`graph_genome_view.md` already argues for it in "Colors that mean the same
thing in both panels" while illustrating itself with rank colors. The linear
segments lane in both sessions now carries the matching `referencePositionColor`
over the graph's own `loadedRegion` (`PATHS_REGION`, `ECOLI_REGION` — named
constants added so the lane's ramp and the graph's cut cannot drift).

The rule applied, so it does not get relitigated: **a graph shown beside a
linear view uses reference-position, a graph shown alone or whose subject is
rank keeps stable-rank.** `rgfa_segment_neighbourhood` (rank-1/rank-2 alleles
are its caption), `rgfa_launch_out_menu` and `rgfa_strain_launch` stay on rank.

`graph_genome_view.md`'s prose (top-of-page caption, rank paragraph) was fixed
to describe the reference-position ramp in `54a955cfff` ("docs(pangenome): fix
the graph figures that lied, and picture the two settings").

**Bubble path counts — decided, no change.** `MinigraphBubbleAdapter` labels
each bubble `<segments>, up to <paths> paths`, and the count is combinatorial
(one class II bubble reports 510,105,601; 406 of release 2's bubbles saturate
int32). The absurd ones only appeared on `hprc_mhc_anchored`, whose bubbles lane
is now gone; C4 and LPA show 98 and 584, which are informative. If it ever needs
suppressing, it can be done **from the spec** with no plugin publish — the
drawn second line is `labels.description` on the canvas display, and the feature
carries `segmentCount`/`longestAlleleLength`, so
`labels: { description: "jexl:get(feature,'segmentCount') + ' segments'" }`
drops the count from the label while leaving it in the details popup.

## Not done — pick up here

**The lines question on `rgfa_segment_neighbourhood`** (open `bad`: "I don't
understand the lines drawn to the backbone. Some only have 1 line and some have
3. How should users interpret these?"). Answered from the data, not yet written
into the docs. Counted out of `ecoli_minigraph.links.bed.gz` over that window
(`chr:4,053,156-4,067,028`):

| node  | rank | length  | links in window |
| ----- | ---- | ------- | --------------- |
| s1814 | 1    | 53 bp   | 2 (s1273 → s1814 → s1275) |
| s1815 | 1    | 60 bp   | 2 (s1275 → s1815 → s1277) |
| s1813 | 1    | 4 bp    | 1 (s1813 → s1273) |
| s1816 | 1    | 1001 bp | 1 (s1278 → s1816) |
| s2272 | 2    | 8643 bp | 1 (s1277 → s2272) |

So: **a line is a graph link.** An allele that both leaves and rejoins the
backbone inside the cut window draws two; one whose other end falls outside the
cut draws only the link with both endpoints on screen. That belongs in the
tutorial prose beside the figure (and one clause in the caption), not in a new
figure. The reviewer also floated a back-to-back anchored/force comparison of
the same locus — **declined**: the HPRC tutorial already pictures both layouts,
and the standing instruction on this set is to pare figures down, not add.

**Unverified observation:** the regenerated `rgfa_hover_sync` shows the hover
tooltip at the bottom-left of the graph pane in both frames, overlapping the
`Sakai` row label. Not obviously caused by the color change (it is a hover
figure and the spec sets `hideTooltip`), but it was not compared against the
pre-change image. Worth one look before committing.

**Also still open from earlier passes**, untouched here: the long crossed
edges visible in `rgfa_subgraph_launch` and `rgfa_sample_rows` are the known
`computeEdgeCurves` reverse-complement endpoint bug in
`jbrowse-plugin-graphgenomeview` (see that repo's `layout/bubbleCrossing.test.ts`
and `PANGENOME_GRAPH_NEXT.md`), not a spec problem.

## Regenerating

`node scripts/generate-screenshots.ts --filter <name> --force` from `website/`
(`--filter` is repeatable and unions). Read its two reports: **content clipped
below the fold** gives the exact css px to raise `viewportHeight` by, and
**blank below the content** the px to lower it. Both beat measuring off a PNG.
`hprc2/mhc_clustered` and `hprc_graph_vs_callset` are the slow ones (real
clustering RPC / 464-haplotype fetch off HPRC's S3).
