---
name: tutorial-grammar-followups
description: What the 2026-09-27 pass applying the grammar of graphics to the tutorials left open - the findings not built, the ones declined and why, the figure warnings it saw, and one agent worktree to clean up. Read before another sweep of the tutorials for keys, scales or axis titles.
---

# Tutorial grammar pass: follow-ups

On 2026-09-27 five read-only agents swept all 64 tutorials for places where the
grammar of graphics would help: a scale, a key, an axis title or a reference line
the figure needed. Two rounds landed. The first was 12 commits ending
`f13c042993`, with 34 figures reshot. The second was the branch ending in this
file, with 15 figures. Colin's steer for both: every change has to show readers
how to do it themselves, as a menu path or a config they can paste.
[[tutorials-teach-the-route-not-the-capability]] in memory holds it.

## What landed

- **Settings only a figure spec held are now in the page's config:**
  methylation, bisulfite, scrna_pseudobulk, hic_structural_variants,
  mappability_qc, pangenome_ecoli, circular_synteny, the population_cnv
  ladder, and cgiab's BIC-seq2 lane.
- **Jexl ternary colours became scales with keys:** alu_age, rnaseq,
  pangenome_prepare_graph, allvsall_synteny, hg002_haplotypes and
  synteny_visualization.
- **Axis and key titles:** Fst, LOD, ΔIF, copy ratio, copy number, CPM and
  FLARE ancestry.
- **Four build scripts stopped writing the `legend` slot ADR-166 removed:**
  chromhmm_roadmap, tcga_cohort_cnv and both dog10k copy-number scripts.
- **tcga_cohort_cnv's subtype recurrence** is one mirrored row per subtype. It
  is a mark display: a `formula` step reads the subtype off each column name,
  and `rows` splits on that field. The worker runs the display's transform
  before the split (`layerFeatures.ts`).
- **homoeolog_synteny has its dS control figure,** `oat_ds`.
- **pangenome_ecoli's variant lane renders phased,** so its key reads per
  haploid strain.
- **The circular view keys strand colour.** TrackColorsMixin gained a
  `shapeShowsStrand()` hook, and the Strand help text no longer promises a
  twist.

## Not built

- **E. coli depth and presence read straight from BED by marks.** This drops
  `bedGraphToBigWig` and a hand-written chrom.sizes. Cost: two build scripts,
  two demo configs and five figures. The multi-wiggle heatmap is the
  established picture, so it was left.
- **k562 DepMap segments as a BED of `rule` marks,** which drops
  `bedGraphToBigWig` there too. Same trade.
- **CNV reference lines** (population_cnv ladder, BIC-seq2 "two copies", cgiab
  BAF). Colin: "i might not do reference lines for cnv". Ask before adding.
- **sv_multisamples: `autoscaleGroup` in place of three hand-pinned lanes.** It
  needs a capture to show whether the coverage band's 0.99 quantile clips RHD's
  spikes. GRAMMAR_OF_GRAPHICS.md says the pin exists to clip them.
- **dtu coverage lanes.** Their shared 0-16 scale lives only in the spec pin;
  whether 16 clips on purpose is unknown.
- **cgiab's NYGC section** configures a link mark, but `sv_callset_comparison`
  draws NYGC as variant ticks. Either the figure shows the links (stems, since
  both mates are off screen there) or the prose stops promising them.
- **genomes_basics:** cCRE, gnomAD and phyloP colours have no key. The fix
  belongs in jb2hubs output, which has to keep loading in older releases.
- **genomes_proteins:** the pLDDT track in the external protein3d plugin
  declares threshold cuts with no `labels` or `title`.
- **pangenome_cactus:** a strain-count line on `builders.png`. The Cactus flank
  sits near 4 rather than 5, so the line would raise a question the page does
  not answer.
- **read_marks:** a 2 kb threshold for the pileup and a "10 pairs" rule on the
  count track. Both are optional.
- **mcscan block bars** could draw a strand key. Skipped: the ribbons already
  show orientation.
- **chromhmm's Broad track** stays on the derived key, because the page uses
  the Roadmap track below it to teach the identity-scale fix.

## Seen in the figures, not fixed

- **Clipped content that predates this work.** Six figures report 8-21 px below
  the fold, with identical amounts on the first shoot: dog10k-cyp1a2-cohort-copy-number,
  hg002_haplotypes_8p23_inversion, multiway_synteny/ecoli_island_lanes,
  cnv1000g/zarr_cohort, paper/cohort_cnv, hg002_haplotypes_follow_panel.
- **Mark display row labels cover the start of the first region's bars.** In
  `tcga/cohort_cnv_recurrence_subtype` they sit over chr1's 1q gain.
- **Phased mode names each haploid row `<strain> HP0`,** as in `pangenome/maf`.
- **`unshown-settings` ratchet +1 on pangenome_prepare_graph,** because its
  **Color by... → Attribute...** route has no figure after it.
- **No check fails a figure spec whose display setting the page's config
  lacks.** The first round found eight such pages. `check-paste-configs` already
  compares tour specs with page fences, and the same comparison for figure
  specs would catch this class.
- **The circle agent's note on linear synteny:** once reordered, linear synteny
  flips antiparallel rows too, so their inverted ribbons draw untwisted. It
  stays unkeyed because the rulers show a flipped row's direction.

## Traps worth knowing

- **Name a compose's parts when you shoot it.** `jb-shoot` given only the
  composite restacks the old parts (see the jb-shoot memory).
- **Don't deploy demos/cgiab/config.json until someone signs off the pending
  change in it.** It holds an undeployed move from `defaultRendering` to `mark`
  on three wiggle lanes, so the cgiab figures carry their CNV colour in their
  sessions instead.
- **A synteny colour takes no `scale: "linear"`.** Its scale enum is `none`, and
  a numeric column is a ramp already; `domainMin` and `domainMax` still pin it.
