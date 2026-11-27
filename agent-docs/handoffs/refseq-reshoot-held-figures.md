---
name: refseq-reshoot-held-figures
description: "Figures the 2026-11-27 RefSeq reshoot held back because something besides the gene descriptions moved: four isoform-chip figures to publish on a look, highlight and wedge colours to trace in git log, and app drift to review per figure. Graph figures are graph-figures-after-plugin-10-8's."
---

# Figures held back from the RefSeq reshoot

On 2026-11-27 the figures `report-stale-figures.py` ties to the hosted
`ucsc/<asm>/ncbiRefSeq*.gff.gz` files were reshot on ada at main `39e6b15721`
and compared with their published copies. Those whose only change was the new
gene description lines were published. The rest moved for another reason too,
so publishing one means reviewing that drift, not the RefSeq change.

The graph figures this reshoot held, the specs failing on the top-level
`color` key and the graph plugin's drift, are listed in
[graph-figures-after-plugin-10-8](graph-figures-after-plugin-10-8.md).

## Next

- **Publish the isoform-chip figures on a look.** The chip reads "MANE Select"
  where it read "Longest isoform", correctly: the RefSeq transcripts gained
  `tag=MANE Select` on 2026-10-28. It is the only other change in
  `genomes_msa/genomic_domains`, `ld/lct_fst_scan`,
  `genomes_basics/multiz_alignment` and `synteny_hg38_hs1_tnnt3`.
- **Trace two colour changes in `git log` before calling either a bug.**
  Highlights are magenta or salmon where they were yellow
  (`protein/tp53_hotspot`, `protein/tp53_nmr_ensemble`, `protein/connected`);
  synteny insertion wedges are white where they were blue or yellow
  (`synteny_te_picalm_alu`, `synteny_human_chimp_cigar_modes`,
  `genomes_synteny/launch_sequence`, `multiway_synteny/hprc_amylase_stack`).
- **Review the app drift figure by figure**, then publish:
  - Multi-way lanes gain "vs hg38" chips, "drawn opposite" titles and a legend
    strip: `multiway_synteny/*`, `pangenome/hprc_cfhr_lanes`,
    `pangenome/hprc_inversion`, `pangenome/hprc_igl_deletion_lanes`,
    `genomes_synteny/mouse_strains_nnt`,
    `genomes_synteny/human_17q21_haplotypes`.
  - Alignments gain Coverage/Pileup chips and new legends:
    `sv_cgiab/driver_cdkn2a_deletion`, `sv_cgiab/deletion_linear_view`,
    `qc/smn1_evidence`, `qc/smn_block_and_reads`,
    `cancer_sv/multihop_split_view`, `read_marks/insert_size`.
  - Specs changed since publish: `genomes_synteny/ribbons_default`,
    `genomes_synteny/ribbons_curved`, `genomes_synteny/ribbon_settings`.
  - Gene tracks repack at wide windows under the label-packing changes
    (`8f893a0fde` among them): `ld/lct_haploblock`, `ld/lct_pooled_vs_panel`,
    `ld/lct_sweep_two_scales`, `popgen/tajimad_cyp6g1`,
    `dog10k-cyp1a2-cohort-copy-number`.
  - Other layout: `clustering/kept_rows` (haplotype row order),
    `genomes_basics/promoter_regulation` (plot-type submenu),
    `cancer_sv/k562_amplicon_dna` (breakpoint brackets),
    `cnv1000g/zarr_cohort`, `scrna/marker_panel`, `protein/tp53_mapped_chain`
    (Ligand legend), `sv_cgiab/deletion_sv_inspector_search`, `multisv_rhd`.
