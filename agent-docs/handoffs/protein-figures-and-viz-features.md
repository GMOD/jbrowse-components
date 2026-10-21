---
name: protein-figures-and-viz-features
description: "Hero figures for the protein browser (genome view linked to one or two Mol* structures). Three variant-to-structure figures landed on protein3d 1.23.0 (TP53 Y220C, BRCA1 M1775R, SNCA E46K) beside the nine older specs. Open: an ortholog alignment that adds evidence, the figures the data supports but nobody has built, and the older figures' known weaknesses."
---

# Protein figures and 3D visualization features: what is left

Revised 2026-10-21. Colin wants figures that win an NIH R01: one story each, a
variant whose structural consequence the reader can see, WILD TYPE / MUTANT
labels and few short callouts, the JBrowse app UI in frame.

## On main

- Three figures, one spec file each, with their sessions beside them:
  `protein_figure_tp53_y220c.ts`, `protein_figure_brca1_m1775r.ts`,
  `protein_figure_snca_e46k.ts`. They load the hosted hg38 config and resolve
  Protein3d from the store (1.23.0). Every number in a callout is measured;
  the spec comments and session files carry the provenance.
- The nine older specs in `protein_variants.ts` (`brca1_sge` retired, replaced
  by the M1775R figure); `protein_variants_kinases.ts`, `_genetics.ts` and
  `_more.ts` are empty and registered.
- Protein3d 1.23.0 added the figure-session properties the three use:
  `camera`, structure `chains`, `surface`, `silhouettes`, `marks`, `distances`,
  orange ligands under mapped-chain coloring, and a protein-change highlight
  label (E46K) that reads as each structure's own residue in 3D. Plugin doc:
  `docs/figure-sessions.md`.
- Hosted data: `jbrowse.org/demos/brca1/BRCA1.sge.missense.bedGraph.gz` and
  `tp53_sge/TP53.sge.missense.bedGraph.gz` (every missense SNV, three rows per
  base), beside the older `apoe/`, `factor_v/` and mean-score bigWigs.

## Next

1. **An alignment that adds evidence.** Tried on M1775R and E46K and removed:
   at figure size the MSA shows about eight rows, all matching human. The
   points it could make need rows it cannot show: Ensembl orthologs carry Leu at
   BRCA1 1775 in a few mammals (Leu works in the scan) and keep a negative
   charge at SNCA 46 (Glu, Asp in fish) in 182 of 183, but the app's NCBI set
   showed Met in every visible row at 1775. A figure would need a filtered,
   taller alignment or a column summary.
2. **Figures the data supports, unbuilt:** VHL hydroxyproline pocket (1LM8 with
   VH032 4W9H, SGE S111/H115 allelic series), MAPT S305I (10IJ vs 7P6D; built
   and dropped: the comparison is one carrier against a different sporadic
   disease, and its 2.5 Å Ile–Phe distance is a model clash), SOD1 H81R,
   DCLRE1C H35D, PTPN11, PTEN.
3. **Cold readers plateaued at 3/5** across about twenty reads, with asks that
   contradict between rounds (connector lines "clutter", then "link not
   shown"). Judge a revision by eye and by Colin, not by another read.

## Known weaknesses

- Y220C shows the pocket by contrast between the two panels; an opaque or
  cut-away surface read worse to every reader.
- M1775R's BACH1 peptide in the mutant panel is superposed from 1T15 (1N5O has
  none); the view's title names that source.
- E46K fibrils are recombinant in-vitro folds; patient-brain folds differ.
- Older figures: HBB pair is the weakest; BRAF, CFTR, APOE and F5 show an orange
  "Not in the link" in the alignment toolbar; the Factor V Manhattan reads as a
  haplotype block.

## Traps

- A spec file that fails to parse breaks every capture, since the generator
  loads them all.
- Adding a view shifts `anchor.view` indexes; a residue callout then anchors
  to the wrong panel without an error.
- `/tmp` is a 16 GB quota tmpfs, so run captures with `TMPDIR=/var/tmp/<dir>`.
- A commit message containing "update docs" deploys the site.
- Screen outputs are machine-local scratch: `/var/tmp/sge-screen/`,
  `/var/tmp/r01-*/`, `/var/tmp/msa/`.
