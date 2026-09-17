#!/bin/bash
# Verdict flips for the 2026-09-17 pass over the bad items, to be run FROM THE
# PRIMARY CHECKOUT once the branch has landed and `pnpm figures:pull` has
# installed the new PNGs there, since an answered entry is hashed against the
# image on disk.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note.
#
# Still bad, and deliberately not flipped:
# - pangenome/hprc_gbz_cfhr_lanes: two bugs. The RPC worker serves
#   @jbrowse/synteny-core as a UI stub, so the graph plugin's worker-side
#   clipSyntenyFeature returns a proxy and the lane fetch throws; and the
#   plugin's own copy of clipFeatureToRegion predates splitAtGapBp, which is
#   why the rows went solid grey before that. Needs a core export and a plugin
#   publish.
# - circular_synteny/rings: the legend is an overlay; a built-in circular view
#   legend is app work.
# - multiway_synteny/ecoli_island_lanes: no redesign settled yet.
set -euo pipefail
cd "$(dirname "$0")/.."

for name in protein/connected protein/tp53_hotspot protein/tp53_mapped_chain; do
  node scripts/flip-review.ts answered "$name" \
    "Genome view on the left, protein view on the right: the spec now uses the plugin's sideBySide launch."
done

node scripts/flip-review.ts answered chromhmm \
  "Rebuilt as a reproduction of Rinn et al. 2007 (Cell 129:1311) Fig. 3 on six of the 127 Roadmap epigenomes. Lung fibroblasts keep HOXA1-A7 active and HOXA9-A13 Polycomb-repressed, foreskin fibroblasts the reverse, and ES cells hold both halves repressed. The 127-row clustering stays in the tutorial's video, so nothing covers the tree any more."

node scripts/flip-review.ts answered gc_content \
  "Yes. Reading left to right the skew flips from + to - at the terminus and from - to + at the origin, where the leading arm wraps through position 0. Both flips are now called out."

node scripts/flip-review.ts answered pangenome/local_subgraph \
  "The pill now says what the open end is and how to close it: the node's other link is outside the extracted region, and a wider region closes it. Here that region holds about 6,000 segments against the 48 drawn, which is why the figure keeps the narrow cut."

node scripts/flip-review.ts answered cancer_sv/k562_bcr_abl_split \
  "Left as is. K562 has no long-read DNA to build the derivative chromosome from (ENCODE's four K562 WGS runs are Illumina), and the Iso-Seq reads are spliced, so a reconstruction from them would build the fusion transcript rather than the der(22) allele."

node scripts/flip-review.ts answered desktop-open-genome-steps \
  "Removed the outline boxes around both controls; the numbered badges and labels stay."

node scripts/flip-review.ts answered cancer_sv/derivative_inserts \
  "Moved the hg38 label into the empty middle of the gene lane, off the gene name."

node scripts/flip-review.ts answered cancer_sv/derivative_synteny \
  "One callout on the dark rows: each molecule crosses that chr3 stretch twice, forward and then inverted, which is the fold-back itself. The overlap colour is unchanged."

node scripts/flip-review.ts answered pangenome/hprc_chm13_allele \
  "The spec now waits for the force layout's loading overlay to clear, and no longer accepts an unsettled capture, so a spinner or a lane error fails the run instead of publishing."

node scripts/flip-review.ts remove hic/loops_and_domains
node scripts/flip-review.ts remove genomes_msa/pyrin_residues
node scripts/flip-review.ts remove genomes_basics/phylop_tp53
node scripts/flip-review.ts remove synteny_follow_unaligned
node scripts/flip-review.ts remove synteny_offscreen_mates_click
node scripts/flip-review.ts remove linkage_groups/alg_dotplot_res_hca
node scripts/flip-review.ts remove linkage_groups/alg_dotplot_res_cow

node scripts/flip-review.ts answered cancer_sv/multihop_reads \
  "Both halves are 1000 px wide, the route label sits next to the tumour track menu it starts from, and a separate arrow crosses the seam."

node scripts/flip-review.ts answered qc/smn_block_and_reads \
  "The top frame carried about 70 px of blank page under the app, so the wedge started below it. The frame now ends at the app and the wedge starts on it; its span was already right (70.85-71.5 Mb)."

node scripts/flip-review.ts answered cancer_sv/k562_fusion_inspector_reads \
  "Zoomed out further on both outer sides, and arcs whose other end is outside both windows are gone. The remaining thin arcs are single split reads, which the display exempts from its support floor on purpose (one chimeric long read is real evidence). Filtering them would need a new split-support setting."

node scripts/flip-review.ts answered pangenome_cactus/graph_bubble \
  "Kept as is. The dashed edge is the route the other four strains take around the IS1 node; without it the insertion looks like the only path and the callout points at nothing."

node scripts/flip-review.ts answered hg002_haplotypes_location_markers \
  "Both rows now open on the same 60 kb span, so they share one bp/px, aligned at the insertion."

node scripts/flip-review.ts answered circular_view/coverage_ring_chords \
  "Coverage is at the bigWig's own resolution now: the ngmlr_cov track no longer sets resolutionMultiplier 10. The legend is still an overlay, as on circular_synteny/rings."

node scripts/flip-review.ts answered linkage_groups/alg_dotplot_res_emu \
  "The comb jelly and Capsaspora plots were sparse because the BCnS groups were defined on sponge, cnidarian and bilaterian chromosomes, and those two genomes do not keep them. Both plots are deleted; the six-genome stack carries the comb jelly fan-out."

node scripts/flip-review.ts answered linkage_groups/alg_stack \
  "Not ideal. autoDiagonalize sweeps top-down from Bolinopsis in its own file order, so every row below, the jellyfish included, is ordered off a comb jelly. The clean order pins the jellyfish row, whose chromosomes are the linkage groups, and sorts outward both ways; Re-order chromosomes has no anchor row yet, so that is an app change, not made in this pass."

node scripts/flip-review.ts answered alu_age/young_share \
  "Removed the strand lane; the strand control stays in the statistics table. Finer windows weaken the trend rather than sharpen it (Spearman rho -0.69 at 1 Mb, -0.63 at 500 kb, -0.52 at 250 kb, -0.36 at 100 kb) as per-bin counts get noisy, so the figure stays at 1 Mb."

node scripts/flip-review.ts answered cancer_sv/k562_amplicon_dna \
  "Three short labels, each with an arrow to the call it names: the two RNA junctions and the break to chr13. The ticks are the display's breakend glyph, a stem with a tick toward the side the derivative keeps, which the tutorial reads, so they stay."

node scripts/flip-review.ts answered pangenome/mouse_nnt \
  "Rebuilt: RefSeq genes and the rGFA segments in the graph's own reference-position colours over the anchored graph, no allele inventory or bubble lanes, bubble labels off, and one callout naming the insertion as the C57BL/6J Nnt deletion, seen from a reference that is C57BL/6J."
