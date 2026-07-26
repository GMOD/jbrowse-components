# Pangenome figures — open work (2026-07-26)

The two `bad` verdicts this file was written for are **closed**; what is left is
one unrelated stale figure at the bottom. The analysis is kept because both
resolutions turned out to hinge on facts about the data that are expensive to
re-derive.

## Closed: `pangenome/local_subgraph`

> "it would be great if we could get coloring on the linear genome view that
> matches up to the graphgenomeview viewer"

Resolved by projecting the subgraph's **own nodes** onto K12 and letting the file
carry the colors, not by finding a track that happened to be colorable.

Two things blocked the obvious recipe (a bicolor `ecoli_pggb_depth` wiggle) and
both are worth knowing before touching this figure again:

- **The hosted depth bigWig is 500 bp binned means.**
  `scripts/build_ecoli_pangenome_graph.sh` tiles K12 into 500 bp windows and asks
  `odgi depth` for each window's mean, so over this 461 bp locus it is one flat
  bar at 4.618. Base-resolution depth is not reachable from any hosted file: it
  needs the `.og`, and the `.og`/full GFA are not in the demo bucket (only the
  461 bp `ecoli_pggb_subgraph.gfa` and an 810 kB rGFA slice), so it would need a
  pggb re-run.
- **pggb's own `-M` MAF disagrees with the graph here.** The MAF has **no CFT073
  row anywhere** in this window — its coverage band reads a flat 4 while the graph
  reads 5 — because it places that copy of the sequence against K12:1,006,313
  instead. Checked against the FASTAs rather than assumed:
  `CFT073:1,048,591-1,048,883` is **96.9%** identical to
  `K12:1,004,669-1,004,961` (the graph's placement) and **25%** identical to the
  MAF's. The graph is right. That is why the figure no longer carries a MAF lane;
  `pangenome/maf` is the MAF's own figure.

What it does carry: `scripts/gfa_nodes_to_bed.py` walks the reference P line
(whose name states its span, since `-E` rounds the requested window out to whole
nodes) and writes BED9 whose `itemRgb` is the plugin's `DEPTH_GRADIENT` viridis
ramp sampled at `(depth - min) / (max - min)` over the subgraph's own min/max —
the same normalization `GeometryBuilder.ts` uses. Depth is P/W traversal count,
floor 1 (`gfaConverter.ts`), which is what the Depth scheme reads when a GFA has
no `dp`/`RC`/`FC`/`KC` tag. So the strip needs no `color` slot and cannot drift.
Over this window: depth 4 (green) to chr:1,004,667, depth 5 (yellow) after, with
1 bp teal/blue ticks where pggb split a SNP into per-allele nodes. The turn is
CFT073 rejoining, and it lands on the ycbF/pyrD boundary.

Wired into the build script and the runnable app config, and hosted as
`ecoli_pggb_subgraph_nodes.bed.gz{,.tbi}` (CloudFront invalidated).

## Closed: `pangenome/hprc_mhc_bandage`

> "can only see 'blue' in the hprc track. if the orange are 'nonreference' and
> cant be shown as segments in the linear genome, what should we do?"

The premise is right and structural: `RgfaTabixAdapter` serves segments by hg38
position and a rank>0 segment has none, so an hg38 lane of that track can only
ever be the blue rank-0 backbone. The answer is that a reference axis can hold
**where** the orange attaches and **how long** it is, so the linear panel now has
both lanes:

- `hprc_minigraph_bubbles` painted `rgb(237,137,44)`, the graph's Stable rank
  ramp at rank 1, set in `test_data/graphgenomeview/hprc.json` so every figure on
  that track matches. At this window that is one 64 kb bubble — which is the
  point: every orange loop in the graph hangs off it.

  **Three figures render that track**, so the recolor also required regenerating
  `hprc_mhc_anchored` and `hprc_c4_subgraph`, and both needed `--force`: their
  `diffThreshold` is 0.1 for FMMM jitter, and a recolored bubble bar moves ~2.4%
  of pixels, so a plain regen logs `≈ kept` and silently publishes the old color.
  Note `--filter` takes only the **last** flag if you pass it twice; run them as
  separate invocations.
- `hprc_minigraph_alleles`, each allele at its anchor and widened to its own bp
  by the CIGAR in the BED (60,569 / 10,246 / 6,025 bp labelled in frame).

Two paths deliberately **not** taken:

- **Recoloring the allele markers to the rank ramp.** Insertion color comes from
  `theme.palette.insertion` (`#800080`), not a track slot, so it would mean
  repurposing a theme color and repainting every alignments figure.
- **A per-allele rank ramp.** The alleles BED *does* carry `discoveryRank`
  (contrary to an earlier note here, which was about the bubbles BED), so a jexl
  could color by it — but the graph normalizes its ramp over the **subgraph's**
  max rank, which a jexl cannot know, and `build_rgfa_alleles.sh` is explicit
  that `discoveryRank` is build order, not carriage. Only the rank-1 end of the
  ramp is honestly reachable, which is what the bubbles lane uses.

## Worth a look: `ecoli_pggb.taf.gz` is a weaker artifact than its siblings

Fallout from the `local_subgraph` diagnosis, measured over the whole hosted file
rather than the one locus. Four figures read this MAF
(`pangenome/maf`, `pangenome/pangenome_variants`'s companion lane, and the
"the MAF is the graph's alignment at base resolution" claim in `pangenome.md`),
so it is worth knowing that:

- **48 of 4,736 blocks carry more than one K12 row** (43 with two, four with
  three, one with five), from repeat collapse. `reroot_maf.py`'s
  `next((k for k, r in enumerate(rows) if r[1] == REF), None)` anchors on the
  **first** such row in pggb's output, not the leftmost, so those blocks' row 0
  (and therefore their `.tai` key) is arbitrary. Block 230 anchors at 221,765
  while a 23 bp K12 fragment at 220,481 sits further down the block.
- **The file is not monotonic in row-0 reference start**: 179 blocks start before
  their predecessor and 431 overlap it, despite the script's
  `blocks.sort(key=...)`. The sibling `ecoli_cactus.taf.gz` measures **0 and 0**
  over 5,887 blocks, so this is specific to the pggb path, not to taffy.
- **It is not an indexing bug.** A `taffy view -r` region query over
  K12:1,004,450-1,005,010 returns exactly the blocks a whole-file dump says
  overlap it, so the missing CFT073 row is absent from the file itself.

**How systemic the under-reporting is: 0.32%, measured.** Per-strain MAF row
absence cross-checked against the per-strain `odgi pav` bigWigs (both hosted). Of
26,194 windows where pav says a strain covers >=90% of the window, **84 have no
MAF row for that strain at all** (42.5 kb, in 30 clusters). Per strain: Sakai
19/7,884, CFT073 33/7,379, NCTC86 8/3,309, IAI39 24/7,622. So the MAF is ~99.7%
faithful to the graph's presence and **no caption or prose needs softening** —
`local_subgraph` simply landed on one of the 30 clusters
(`chr:1,005,000-1,006,000`, CFT073).

Checked against every figure locus that reads this file: the nearest cluster to
`pangenome/maf` (chr:4,540,000-4,600,000) is chr:4,623,500-4,624,000, outside it,
and `pangenome/pangenome_variants` (chr:2,120,000-2,140,000) is clear too. The
cluster at chr:1,097,500-1,098,500 does sit inside `PATHS_WINDOW`, but those
figures read the minigraph paths/alleles BEDs, not the MAF. **Pick a new
MAF-bearing locus against the 30-cluster list**, which regenerates from the
recipe in [[key_pattern_pggb_maf_reroot_multi_ref_row]].

## Not a bug: every graph figure's live link 404s until the next release

These figures run on `test_data/graphgenomeview/{config,hprc}.json`, and their
auto-appended live link is built against `JBROWSE_CODE_BASE`, which defaults to
the **released** app. `latest` ships the `test_data` tree as of its own release,
so a fixture directory added since then is missing:

```
404  https://jbrowse.org/code/jb2/latest/test_data/graphgenomeview/config.json
200  https://jbrowse.org/code/jb2/main/test_data/graphgenomeview/config.json
200  https://jbrowse.org/code/jb2/latest/test_data/volvox/config.json
```

It fixes itself at the next release, and `deploy_staging.sh` already points at
`code/jb2/main/`. **Do not "fix" it with `link=""`** — that string is falsy in
`remark-figure.ts`, so it drops the figure's **recipe dialog** along with the
link, and the dialog (click path, session JSON, Desktop link, notebook snippet)
works regardless of whether the config URL resolves. Reserve `link=""` for
figures with no session at all, like the two odgi-viz rasters.

## Still open: the launch-dialog figure

`multiway_synteny/ecoli_launch_dialog` (and the `_from_selection` stack it feeds)
was captured against the `products/jbrowse-web/build` that predates commit
`4c96431`, which reworked that dialog (anchor as a movable row, select all/none,
shared window-size field). It needs a `pnpm build` in `products/jbrowse-web`
followed by `--filter=ecoli_launch` to match what the tutorial now describes.
