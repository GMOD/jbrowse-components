---
name: protein-figures-and-viz-features
description: "Hero figures for the protein browser (genome view linked to one or two Mol* structures). Five figures on protein3d 1.24.0: a saturation scan painted on the fold beside AlphaMissense (BRCA1 1T15, TP53 3KMD) and three variant pairs (TP53 Y220C, BRCA1 M1775R, SNCA E46K). Open: which one the grant leads with, the TP53 painting's contrast, and the older figures' weaknesses."
---

# Protein figures and 3D visualization features: what is left

Revised 2026-10-21. Colin wants figures that win an NIH R01: one story each, the
JBrowse app UI in frame, short callouts, and several candidates to pick from or
present together.

## On main

- **Scan vs AlphaMissense**, `protein_figure_scan_vs_alphamissense.ts`: the
  genome view at codon resolution with every missense change of a saturation
  scan as a dot and the hub's AlphaMissense four-row heatmap, above one fold
  drawn twice, colored by the scan's residue mean (`color.field: 'track'`) and
  by AlphaMissense, one camera. BRCA1 1T15 (chains A and B, M1775R) and the
  TP53 3KMD dimer on DNA (chains A, B, E, F, R248Q). Sessions beside the spec;
  the builders that wrote them, the in-page camera reader and the capture
  script with a paint gate are machine-local in `/var/tmp/hero-figures/`.
- **Variant pairs**, one spec file each: `protein_figure_tp53_y220c.ts`,
  `protein_figure_brca1_m1775r.ts`, `protein_figure_snca_e46k.ts` (now four
  sentence callouts fewer).
- The nine older specs in `protein_variants.ts`.
- Protein3d 1.24.0: `protein-view-ready` waits for a color field's values and
  the paint that follows (1.23.0 flipped it 20–40 s early for `track`,
  `alphaMissense` and `clinvar`, and a capture showed Mol*'s chain colors under
  the right legend), and `occlusion: true` beside `silhouettes`. Plugin doc:
  `docs/figure-sessions.md`.
- Hosted data: `jbrowse.org/demos/brca1/` (every missense SNV, residue mean
  bigWig) and `tp53_sge/` (every missense SNV, position mean bigWig).

## What the 2026-10-21 reviews said

Three reads, in `/var/tmp/hero-figures/review/` (a cold reviewer of the eight
figures, a blinded ideator given only a capability sheet, a landscape survey):

- No surveyed tool (UCSC, Ensembl, gnomAD, cBioPortal, COSMIC-3D, ProtVar,
  MaveDB, G2P, AlphaFold DB) puts nucleotide-level tracks in a genome browser
  linked to a structure; the ideator and an independent prototype converged on
  the scan-painted fold beside AlphaMissense.
- The cold reviewer ranked the pairs snca_e46k 7.5, brca1_m1775r 6.5,
  tp53_y220c 6, every older figure 4 or below; one hue shared by the codon
  column, its chip and the residue is what carries the link; the MSA panel
  hurts in every figure that has it.

## Next

1. **Which figure leads.** Colin picks, or the grant shows several.
2. **TP53's painting has less contrast than BRCA1's**: the Funk scan's mean per
   codon sits near zero over much of the domain, so the 2-class threshold at 0
   paints a mottled dimer. A cut at the paper's own call, or the residue mean
   over the three classes, may read better.
3. **Occlusion is subtle** in software GL at figure size; worth a headed
   capture before deciding it stays on.
4. **SNCA**: the reviewer's remaining asks are not done: a superposition so
   Lys80 sits at the same screen position in both panels, "a different fibril
   fold" in the caption, and a wild-type Glu46–Lys80 distance. The last was
   tried: a 3 Å line's label lands on the residue labels.
5. **Figures the data supports, unbuilt:** VHL hydroxyproline pocket (1LM8 with
   VH032 4W9H, SGE S111/H115 allelic series), SOD1 H81R, DCLRE1C H35D, PTPN11,
   PTEN.

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
- The website generator has no in-page wait, so a figure whose color arrives
  late depends on the plugin's ready marker covering it; a fixed `delay` shot
  green folds in a different panel each run.
- `/tmp` is a 16 GB quota tmpfs, so run captures with `TMPDIR=/var/tmp/<dir>`.
- A commit message containing "update docs" deploys the site.
- Screen outputs are machine-local scratch: `/var/tmp/hero-figures/`,
  `/var/tmp/proto-shots/`, `/var/tmp/sge-screen/`, `/var/tmp/r01-*/`.
