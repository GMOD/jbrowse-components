---
name: protein-figures-and-viz-features
description: "Hero figures for the protein browser (linked genome view, ortholog alignment, one or two Mol* structures): nine specs on main and eight in the genomes_proteins tutorial. Open: color the structure from a genome track (BRCA1 saturation genome editing is the target), the unbuilt surface/distance/camera features, and figures the data supports but nobody has built (SOD1 H81R, DCLRE1C, PTPN11, VHL, PTEN)."
---

# Protein figures and 3D visualization features: what is left

Revised 2026-10-20. Colin wants figures that win an NIH R01: one story each,
as few and as short red callouts as possible, nothing the reader must decode.

## On main

- Specs in `website/scripts/specs/protein_variants.ts` (shared helpers are
  exported) with three empty registered files, `protein_variants_kinases.ts`,
  `_genetics.ts` and `_more.ts`, for further figures. Figures: `kras_g12c`,
  `kras_two_drugs`, `braf_v600e`, `cftr_f508`, `apoe_e4`, `f5_leiden`,
  `brca1_sge`, `tp53_r273h`, `hbb_e6v`.
- A second protein view beside the first: `pairStructure` and `pairColor` on
  `SessionOptions`. A callout picks its view with `anchor.view`; Reset Zoom is
  clicked per `view-container-<viewId>`.
- Eight of the nine are in the figure store and in the "More protein browser
  sessions" section of `tutorials/genomes_proteins.md`; `kras_g12c` is not
  (the two-drug pair replaces it). The page lowers nothing in the
  figure-actions ratchet: it adds 8, because gallery figures follow no
  instruction.
- Hosted data under `jbrowse.org/demos/`: `apoe/` and `factor_v/` (FinnGen R12
  slices), `brca1/` and `tp53_sge/` (saturation genome editing, MaveDB
  scores mapped to hg38). Recipes: memory `finngen-slices-hosted-for-manhattan-figures`.

## Next, in order

1. **Color a structure from a genome track.** The `protein3d` plugin has a
   placed-value registry (`src/ProteinView/placedValueRegistry.ts`) that feeds
   `alphaMissense`, `clinvarPathogenicCount` and `domain`; a `track` source
   (bigWig, mean over the codon's three bases) is not built. An agent started it
   in a local checkout of the plugin repo and may have committed part of it:
   check the plugin repo's git log before redoing it. Target: `brca1_sge` with
   the structure colored by `BRCA1.sge.residue_mean.bw` at the published
   thresholds (-1.328, -0.748; loss of function is negative). Needs a
   fixed-threshold ramp, a direction flag and a legend. Conservation coloring is
   rejected: it says "conserved" for nearly every exon.
2. **Surface, distance dashes, neighborhood sticks, camera, RMSD readout.**
   Nothing exists: the agent stopped before writing code. They are Mol* runtime
   APIs driven by autoruns from session properties, plus menu entries.
   MolViewSpec cannot do it (it builds an initial scene and does not react).
3. **Figures the data now supports**, ranked by the screens:
   - Saturation genome editing with variants of uncertain significance:
     BRCA1 BRCT (1T15, built, three VUS), TP53 (built; check the track's sign,
     the drawn bars lean opposite to "higher is loss of function"), RAD51C
     (8FAZ, loss-of-function residues sit at the ATP site).
   - Wild-type against mutant pairs with a measured change, from the table the
     pair agent saved: SOD1 H81R (2C9S to 3H2Q, VUS H72Q and D84N with MaveDB
     00001217 scores), DCLRE1C H35D (7AF1 to 7AGI, both active-site zincs
     lost), HMBS R173W, BRAF 1UWH to 1UWJ (UniProt 448 against author 447).
   - Pathogenic against population variants: only PTPN11 (2SHP), VHL (1LM8)
     and PTEN (1D5R) show pathogenic variants concentrated at an exposed
     functional site; every other protein screened shows burial, which Colin
     does not want. Needs per-residue gnomAD counts on the structure (item 1).
4. **Unbuilt drafts from the builder agents** (session JSON and spec text, never
   rendered or committed, in the agents' own checkouts and lost when those go):
   EGFR, PIK3CA, IDH1, ESR1, ABL1, PCSK9, CFH, HFE, SERPINA1, PNPLA3, rpoB,
   SNCA. Rebuild them from the helpers.

## Known weaknesses

- HBB pair: the session highlight draws orange spheres on both structures, which
  hides glutamate against valine. Weakest figure; drop or rethink.
- The alignment toolbar shows an orange "Not in the link" on BRAF, CFTR, APOE
  and F5.
- Session highlight colors: alpha turns the 3D spheres dark; an opaque color
  hides alignment letters. The default color is the only workable choice.
- Factor V: rs6025 tops a broad plateau of nine linked variants at about 230 to
  249, so the Manhattan reads as a haplotype block.
- Ortholog alignments at BRCA1, TP53 and F5 were not checked for a contrast at
  the codon.
- The BRCA1 and TP53 scores partly circle back through ClinVar, which used
  them as evidence.

## Traps

- FinnGen's bucket sends no CORS headers and Pan-UKB files are hg19; slice and
  host (above). Remote `tabix` leaves a `.tbi` in the cwd.
- `/tmp` is a 16 GB quota tmpfs: run captures with `TMPDIR=/var/tmp/<dir>`.
- The capture needs a static server on the main checkout's `jbrowse-web` build
  (`--port`), and a figure on disk before the diff gate runs.
- A commit message containing "update docs" deploys the site.
- Agent runs stopped on the account's spend limit (and Fable's weekly limit,
  reset 2026-10-25): resume a stopped agent with `SendMessage`; a new agent starts cold.
- Screen outputs are machine-local scratch: `/var/tmp/sge-screen/`,
  `/var/tmp/path-wt-pairs/`, `/var/tmp/variant-3d-screen/`. The scripts and
  tables rebuild from MaveDB, ClinVar, gnomAD and RCSB.
