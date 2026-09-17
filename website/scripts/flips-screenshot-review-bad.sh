#!/bin/bash
# Verdict flips for the 2026-09-17 evening pass over the bad items, to be run
# FROM THE PRIMARY CHECKOUT once the branch has landed and `pnpm figures:pull`
# has installed the new PNGs there, since an answered entry is hashed against
# the image on disk.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note.
#
# FOUR FIGURES ARE ANSWERED BUT NOT RE-RENDERED HERE. Their specs changed and
# the page crashed the renderer on this machine every time (three retries each,
# at load average 2 as well as 12), so the committed PNG is the old one and the
# weekly sweep is what will draw them: sv_cgiab/cnv_depth_baf,
# multiway_synteny/hprc_chr12_whole, ld/lct_haploblock and
# cancer_sv/multihop_split_view (with cancer_sv/multihop_reads, which composes
# it). Each note says what the spec now asks for.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/flip-review.ts answered track_menu \
  "The box around the menu is gone; the two rings on the menu icons stay, and the label's is tight enough to stay off the menu hanging under it."

node scripts/flip-review.ts answered scroll_zoom_toggle \
  "A rectangle around the control, and the pill says what it turns on rather than where it applies: the scroll wheel zooms instead of scrolling the page."

node scripts/flip-review.ts answered trio-crossover-maternal \
  "Back to blue. The phased alt fill moved off set1 yesterday so that red would mean deletion in SV mode and nothing elsewhere; it is set1 blue again, and the secondary alt keeps the pink that is off the SV scale."

node scripts/flip-review.ts answered chromhmm \
  "Rebuilt as Roadmap Epigenomics 2015 (Nature 518:317) Fig. 3a: all 127 epigenomes over the chr9 stretch from FAM205A to ALDH1B1, in the paper's own tissue-group order with the group stripe beside the rows. Promoter columns run through nearly every row and PAX5 is transcribed only in the B cell rows, which is the density the six-row HOXA figure could not carry. That one stays as chromhmm_hoxa_fibroblasts for the domain paragraph. A single-cell version is possible but not on data we host: CATlas (Zhang et al. 2021) publishes 222 per-cell-type hg38 bigWigs, 105 GB in all, and the figure would be a marker-gene staircase over 100+ rows."

node scripts/flip-review.ts answered multiway_synteny/ecoli_one_vs_all \
  "The rGFA segments lane sits under the gene track in the graph pane's own reference-position ramp, so a node below and its span above share a hue."

node scripts/flip-review.ts answered multiway_synteny/grape_peach_cacao_gene_orthologs \
  "All three windows run past the array, and the pill leads to it rather than sitting over it."

node scripts/flip-review.ts answered multisv_svtype \
  "Copy number is teal. Pink was the obvious set1 spare and would have been worse: a het insertion shades from purple to magenta, which is the colour the reader would have matched it to."

node scripts/flip-review.ts answered sv_cgiab/cnv_depth_baf \
  "The GRCh38_GIABv3 assembly in the hosted cgiab config carries UCSC hg38 cytobands now, so the ideogram bands the arms, and a cytoband track draws them in the view as well. NOT RE-RENDERED: the page crashed the renderer here, so this figure is the sweep's."

node scripts/flip-review.ts answered pangenome/rgfa_subgraph_launch \
  "The reference-position legend names the span's length beside its two ends, and every bubble label is the short notation now: 135 bp del, 49 bp del, 12 kb ref to 8.6-13 kb with 9 alleles. Published as plugin c14f18b."

node scripts/flip-review.ts answered pangenome/rgfa_launch_out_menu \
  "The graph is coloured by reference position and the segments track it carries into the launched K12 panel is painted in the same ramp, so the same rainbow is in both frames."

node scripts/flip-review.ts answered pangenome/rgfa_hover_sync \
  "The pane is capped at 420 px and the bubble halos and gene overlay are off, which is what was covering the hues; the gene lane above still names the genes."

node scripts/flip-review.ts remove tcga/mutations_tp53_subtype

node scripts/flip-review.ts answered ld/lct_haploblock \
  "Clustered over the highlighted LCT/MCM6 stretch alone rather than over the whole r-squared block. NOT RE-RENDERED: the page crashed the renderer here on the old spec as well as the new one, so this figure is the sweep's."

node scripts/flip-review.ts answered cancer_sv/multihop_reads \
  "The fourth panel is gone. A breakpoint split view opens one panel per visited window rather than per segment, so the fold-back's return to the chr3 junction it starts from shares the first panel, which is where the split view was attaching those alignments anyway. NOT RE-RENDERED: the split-view half loses its WebGL contexts on this machine, so the committed PNG is the old one and the sweep will draw it."

node scripts/flip-review.ts answered cancer_sv/multihop_split_view \
  "Same change as cancer_sv/multihop_reads: three panels, not four, and the panels are 160 px of pileup each so three fill the frame. NOT RE-RENDERED here."

node scripts/flip-review.ts answered pangenome/pggb_untangle_rows \
  "The cross-reference is gone from both figures; each says what its own box holds."

node scripts/flip-review.ts answered sv_cgiab/three_ways \
  "The picker collapses every route with under a quarter of the top route's reads behind one row that says so, and the callout points at that row. Here that hides six of the seven."

node scripts/flip-review.ts answered pangenome_cactus/graph_bubble \
  "Deletion edges are a setting now, off by default, so this figure draws the node and its two neighbours with no dashed arc. The five figures whose captions read the arc set it true, and the cactus tutorial names the menu item instead of describing an edge that is no longer there."

node scripts/flip-review.ts answered synteny_offscreen_mates \
  "One frame instead of two. The pair differed by a strip a few pixels tall, so the marks are on and a pill names them: peach alignments whose grape end is on another chromosome."

node scripts/flip-review.ts answered circular_synteny/rings \
  "Built in now: Show legend on the circular view menu draws a key naming each ring, chord and ribbon track beside the colour or density ramp it draws in, and the SVG export draws the same key. The overlay is gone from all three circular figures, and this figure's density ring is orange so the ring and the ribbons no longer share one blue."

node scripts/flip-review.ts answered circular_view/coverage_ring_chords \
  "The same built-in key, off the tracks themselves."

node scripts/flip-review.ts answered circular_synteny/x_control \
  "The same built-in key, and the gene density ring is orange against the steel-blue ribbons."

node scripts/flip-review.ts answered linkage_groups/alg_stack \
  "Resolved. Re-order chromosomes takes an anchor row: the row picked keeps its order and the sweep runs outward both ways from it, so this stack anchors on the jellyfish whose chromosomes are the linkage groups. The dialog asks for it on three rows or more."

node scripts/flip-review.ts answered multiway_synteny/ecoli_alignment_menu \
  "The three ways out sit in a Launch submenu now, in this menu and everywhere LGVSyntenyDisplay draws one."

node scripts/flip-review.ts answered multiway_synteny/ecoli_island_lanes \
  "The gridlines were the view's own, true only at the anchor lane's scale, so they are off and each lane's own ticks are what is left. The depth wiggle is 120 px rather than 60, where the drop from five genomes to two was a 24 px step, and one pill says what the step counts."

node scripts/flip-review.ts answered pangenome/hprc_gbz_cfhr_lanes \
  "Fixed by the plugin publish. The graph plugin bundles its own clip code rather than taking it from the worker's synteny-core stub, and its copy has splitAtGapBp, so the lanes draw their genes and the ribbon narrows to nothing across the CFHR3-CFHR1 deletion instead of going solid grey."

node scripts/flip-review.ts answered context_levels \
  "Human, and filmed. Three levels of COLO829 on hg38: tumour coverage at 5 Mb over the gene track at 200 kb over the ONT reads at a kilobase of TP53. ui/context_levels films the route to that stack, since each level arrives empty and picks its own track."

node scripts/flip-review.ts answered maf_summary_hprc_chromosome \
  "Kept, with the reference it was missing: the assembly carries cytobands now, so the gap that runs clear across every row sits under the ideogram's centromere. The black is the summary tier's own shading, since human haplotypes score at the top of the scale, and absence is what the figure is of."

node scripts/flip-review.ts answered mark_display/facet \
  "Brainstorm, nothing built. Mismatches fit the same grammar as soon as something emits one feature per mismatch: a transform on the alignments adapter, beside the coverage transform the circular guide already names, would hand the mark display a feature per mismatch carrying base, quality and strand. Then colour by base, facet by base and plot quality are the channels that already exist, and the work is the transform rather than the view. Without it the display can only draw one mark per read, which is the read-level view this figure has."

node scripts/flip-review.ts answered mark_display/plot_field \
  "Answered, nothing built. Two JSON routes exist already: Share, then the settings icon and Plaintext JSON, prints the session JSON a reader can paste back, and jb.applyChannelSpec takes a channel spec for an agent. A paste box in this dialog would be a third spelling of the same state, so if you want one the place for it is the display's own settings dialog, where it would cover every channel rather than this dialog's three fields."

node scripts/flip-review.ts answered multiway_synteny/hprc_chr12_whole \
  "Cytobands are on the hosted hprc_multiway config now, so the ideogram bands chr12 and the stretch no haplotype aligns sits under the centromere. The chr-naming is NOT done and needs a decision: the assembly reads jbrowse.org's hg38.prefix.fa.gz, whose refNames are 1, 2, 3 despite the name, and no chr-named hg38 is hosted beside it, so chr12 means rebuilding the assembly and the PIF it is indexed against. NOT RE-RENDERED: the page crashed the renderer here."

node scripts/flip-review.ts answered pangenome/genomes_hprc_cfhr_haplotypes \
  "Widened to 150 kb. CAT annotation per row is a jb2hubs job rather than a figure one: the lanes take the best single-assembly track the session holds for each haplotype, and this page's config carries none, where the demos/hprc config has a CAT slice per haplotype for its own eight."
