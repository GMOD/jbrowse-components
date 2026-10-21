---
name: protein-figures-and-viz-features
description: "Hero figures for the protein browser (genome view linked to one or two Mol* structures). Five figures on protein3d 1.24.0, none yet the hero: Colin read the scan-vs-AlphaMissense pair as 'CRISPR matches prediction', not a story. Open: a figure whose variant has a consequence the reader can see, built on the three variant pairs and the reviewer's upgrades."
---

# Protein figures and 3D visualization features: what is left

Revised 2026-10-21, evening. Colin wants figures that win an NIH R01: one story
each, a variant whose structural consequence the reader can see, the JBrowse
app UI in frame, short callouts, and several candidates to pick from or present
together.

## Colin's read of the 2026-10-21 round

- **The scan-vs-AlphaMissense pair is not the hero.** His words: it "just says
  'crispr matches prediction'", and he doubts that is a good story. Both
  figures stay in the gallery as the capability no other tool has (a genome
  track painting a fold), but the grant figure has to show what a variant
  *does*, which an agreement between two per-residue maps does not.
- **The painted fold misreads on first contact.** He took the red for damage
  spreading from M1775R. Each residue's color is the effect of changing that
  residue, on the wild-type fold; the mutant never appears. The pills name the
  source that painted each fold, not what the color means. Any reuse of the
  painted fold needs a key that says "effect of changing each residue".
- Carry forward from his earlier reactions: WILD TYPE / MUTANT pills are
  "turbo clear"; keep the app chrome; short callouts.

## On main

- **Scan vs AlphaMissense**, `protein_figure_scan_vs_alphamissense.ts`: BRCA1
  1T15 (chains A and B, M1775R) and the TP53 3KMD dimer on DNA (chains A, B,
  E, F, R248Q), the genome view at codon resolution with the scan's dots and
  the hub's AlphaMissense heatmap, the fold painted by `color.field: 'track'`
  and by `alphaMissense`, one camera. Sessions beside the spec; the builders,
  the in-page camera reader and the capture script with a paint gate are
  machine-local in `/var/tmp/hero-figures/`.
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

## What the three reviews said

In `/var/tmp/hero-figures/review/` (a cold reviewer of the eight figures, a
blinded ideator given only a capability sheet, a landscape survey):

- No surveyed tool (UCSC, Ensembl, gnomAD, cBioPortal, COSMIC-3D, ProtVar,
  MaveDB, G2P, AlphaFold DB) puts nucleotide-level tracks in a genome browser
  linked to a structure.
- The cold reviewer ranked the pairs snca_e46k 7.5, brca1_m1775r 6.5,
  tp53_y220c 6, every older figure 4 or below. One hue shared by the codon
  column, its chip and the residue is what carries the link; the MSA panel
  hurts in every figure that has it; sentence callouts dilute.
- Its two concrete upgrades, neither built: SNCA with both fibrils superposed
  so Lys80 sits at the same screen position, and a Y220C figure in three linked
  panels (2XWR with Tyr220 plugging the site, 2J1X with the crevice open, 9S9O
  with rezatapopt in it), opaque surface clipped at the pocket, the scan as the
  only genome track. Note 2J1X carries four stabilizing mutations.
- The ideator's other concepts: two exons holding one zinc atom (TP53 C176 and
  H179 from exon 5, C238 and C242 from exon 7, as two regions with a gap
  marker and dashed distances to the zinc), and an AlphaGenome splice
  prediction against Funk's validated exonic splice SNVs (codons 199 and 137)
  with the skipped exon colored on the fold.

## Next

1. **A hero with a cause.** Start from the variant pairs, since each shows a
   consequence: Y220C's pocket and its drug, M1775R's clash with the partner's
   Phe, E46K's lost salt bridge. The reviewer's three-panel Y220C is the most
   complete candidate; the SNCA superposition the cheapest upgrade.
2. **The painted fold as a supporting layer, not the subject**: a variant pair
   whose wild type is painted by the scan says both what the residue does and
   that the whole map agrees, if the key says what the color means.
3. **TP53's painting has less contrast than BRCA1's**: the Funk scan's mean per
   codon sits near zero over much of the domain, so the 2-class threshold at 0
   paints a mottled dimer.
4. **Occlusion is subtle** in software GL at figure size; worth a headed
   capture before deciding it stays on.
5. **Figures the data supports, unbuilt:** VHL hydroxyproline pocket (1LM8 with
   VH032 4W9H, SGE S111/H115 allelic series), SOD1 H81R, DCLRE1C H35D, PTPN11,
   PTEN.

## Known weaknesses

- Y220C shows the pocket by contrast between the two panels; an opaque or
  cut-away surface read worse to every reader.
- M1775R's BACH1 peptide in the mutant panel is superposed from 1T15 (1N5O has
  none); the view's title names that source, and the reviewer wants "modeled"
  in large type.
- E46K fibrils are recombinant in-vitro folds; patient-brain folds differ, and
  6CU7 and 6UFR are different polymorphs, so "the fold rearranges" overclaims.
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
- A 3 Å distance line's label lands on the residue labels; the wild-type
  Glu46–Lys80 line was tried on SNCA and dropped.
- `/tmp` is a 16 GB quota tmpfs, so run captures with `TMPDIR=/var/tmp/<dir>`.
- A commit message containing "update docs" deploys the site.
- Screen outputs are machine-local scratch: `/var/tmp/hero-figures/`,
  `/var/tmp/proto-shots/`, `/var/tmp/sge-screen/`, `/var/tmp/r01-*/`.
