---
name: figures-behind-app-changes
description: "59 published figures that draw the hosted RefSeq tracks differ from a 2026-11-27 reshoot for reasons other than RefSeq's new gene descriptions: four specs fail, two drifts look like regressions, and the rest is app and plugin drift waiting on a reviewed sweep."
---

# Figures behind app changes

On 2026-11-27 the 73 figures `report-stale-figures.py` tied to the hosted
`ucsc/<asm>/ncbiRefSeq*.gff.gz` files were reshot on ada at main `39e6b15721`
and compared with their published copies. The eight whose only change was the
new gene description lines, and `qc/smn_vs_t2t` with its hg38 descriptions
hidden, were published. These were held back because something else moved
too; publishing them means reviewing that drift, not the RefSeq change.

## Specs that fail

- `protein/annotation_1d` and `genomes_msa/launch_sequence` time out at
  `waitForText` on "Launch protein view" and "Launch MSA view": the feature
  menu now nests those under a "Launch ›" submenu.
- `pangenome/hprc_abca7_repeat_units`, `pangenome/hprc_amylase_walk_rows`,
  `pangenome/graph_kiv2_walk_rows` and `pangenome/graph_mouse_nnt_halos` fail
  on `LinearGraphDisplay … ignored unknown key(s): color`, the respelling
  `handoffs/graph-figures-after-plugin-10-8.md` holds.

## Drifts that may be regressions

- `pangenome/bovine_whole_chromosome`: the variability track shows "Requested
  too much data (1.8 MB)… FORCE LOAD" over chr23 where it drew bars.
- `scrna/percell_lyz`: the per-cell track colours by score where it coloured
  by cell type. `65b8c5c6f3` ("the multi-row display draws what its config
  states") likely made that a config question for
  `test_data/scrna_pbmc5k/config.json`.
- Highlights are magenta or salmon where they were yellow
  (`protein/tp53_hotspot`, `protein/tp53_nmr_ensemble`, `protein/connected`),
  and synteny insertion wedges white where they were blue or yellow
  (`synteny_te_picalm_alu`, `synteny_human_chimp_cigar_modes`,
  `genomes_synteny/launch_sequence`, `multiway_synteny/hprc_amylase_stack`).
  Check `git log` for a deliberate colour change before calling either a bug.

## App and plugin drift

- **Isoform chip** reads "MANE Select" where it read "Longest isoform": the
  RefSeq transcripts gained `tag=MANE Select` on 2026-10-28, after these were
  shot. Correct, and the only other change in `genomes_msa/genomic_domains`,
  `ld/lct_fst_scan`, `genomes_basics/multiz_alignment` and
  `synteny_hg38_hs1_tnnt3`, which can publish on a look.
- **Graph plugin**: rGFA strips and node colours now a continuous rainbow, or
  graph panes relaid out with node-length labels and a WALKS legend; the
  `pangenome/bovine_*`, `pangenome/fly_*`, `pangenome/hprc_c4_*`,
  `pangenome/graph_kiv2_walks`, `pangenome/hprc_lpa_kiv2`,
  `pangenome/hprc_graph_anatomy`, `pangenome/hprc_graph_vs_callset`,
  `pangenome/hprc_cfh_graph_launch`, `pangenome/hprc_haplotype_launch` and
  `pangenome/mouse_dock2` figures.
- **Multi-way lanes** gain "vs hg38" chips and "drawn opposite" titles, legend
  in a strip: the `multiway_synteny/*` figures, `pangenome/hprc_cfhr_lanes`,
  `pangenome/hprc_inversion`, `pangenome/hprc_igl_deletion_lanes`,
  `genomes_synteny/mouse_strains_nnt`, `genomes_synteny/human_17q21_haplotypes`.
- **Alignments** gain Coverage/Pileup chips and new legends:
  `sv_cgiab/driver_cdkn2a_deletion`, `sv_cgiab/deletion_linear_view`,
  `qc/smn1_evidence`, `qc/smn_block_and_reads`, `cancer_sv/multihop_split_view`,
  `read_marks/insert_size`.
- **Specs changed since publish**: `genomes_synteny/ribbons_default`,
  `genomes_synteny/ribbons_curved`, `genomes_synteny/ribbon_settings`.
- **Gene tracks repack** at wide windows under the label-packing changes
  (`8f893a0fde` among them): `ld/lct_haploblock`, `ld/lct_pooled_vs_panel`,
  `ld/lct_sweep_two_scales`, `popgen/tajimad_cyp6g1`,
  `dog10k-cyp1a2-cohort-copy-number`.
- **Other layout**: `clustering/kept_rows` (haplotype row order),
  `genomes_basics/promoter_regulation` (plot-type submenu), `cancer_sv/k562_amplicon_dna`
  (breakpoint brackets), `cnv1000g/zarr_cohort`, `scrna/marker_panel`,
  `protein/tp53_mapped_chain` (Ligand legend), `sv_cgiab/deletion_sv_inspector_search`,
  `multisv_rhd`.
