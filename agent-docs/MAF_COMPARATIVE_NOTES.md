# MAF comparative-genomics: MCGV findings + roadmap

Working notes for the grant goal "show gene structure across multiple species" on
the `LinearMafDisplay`. Companion to the bigMafSummary + CDS-frames work already
landed (see `plugins/maf`, and the `key_pattern_maf_cds_frames_overlay` memory).

## Shipped so far

- **Per-species CDS frame overlay** (`annotationAdapter` = UCSC `mafFrames` bigBed
  on the display): thin reading-frame-colored strip per species row, `src`→row.
  Hover any row → gene name + reading frame. Screenshot: `maf_cds_frames`
  (`test_data/ce_maf_frames.json`, local bigBed built from real ce11
  multiz26wayFrames).
- **Codon view** (per-species amino-acid translation in the reference reading
  frame; replaces the SNP cells with per-codon syn/nonsyn/stop coloring). Polish
  landed: hover tooltip (`findCodonAt` → codon nt · AA · ref AA · syn/nonsyn),
  anchor tied to the *reference assembly* (`defaultCodonSpecies` resolves
  `lgv.assemblyNames[0]`, not the reordered `sources[0]`), dark-mode-tuned fill
  alphas, and **cross-exon stitching**. A codon is modeled as three reference
  positions (ascending genomic); `enumerateCodons` walks each exon in
  transcription order (one strand-agnostic path via `txPos`) and completes a
  trailing partial codon from the next exon via `nextFramePos` (the 4 extra
  `mafFrames` columns now flow through `MafFrameRecord`). The boundary codon
  paints one cell per exon piece (glyph on the wider). Both exons must be in one
  fetched MAF block (reference is contiguous across introns), else the codon is
  dropped as before.
- **Color-by-source-chromosome SV mode** (`colorByChromosome` toggle →
  `activeRowRendering === 'sourceChrom'`): each species' alignment blocks filled
  by a stable hash color of `MafAlignedRow.chr`, so a row drawing from >1 source
  chromosome changes color = translocation/rearrangement flag. Zero new fetch.
  Detail view only (summary path carries no per-row chr). Compact legend overlay
  (`visibleSourceChromosomes`). Canvas + SVG export both branch on the shared
  `activeRowRendering` getter.
- **Inversion (strand-flip) indicator** (`showInversions` toggle, an *overlay*
  not a mode): hatch + outline on a block whose strand differs from the
  length-weighted consensus orientation of its own `(row, source chromosome)` —
  so arbitrarily-oriented scaffolds aren't mistaken for inversions, only genuine
  intra-scaffold flips. `computeVisibleInversions` + `drawInversions`
  (colorLongreadInv). Found+fixed a latent bug: **`MafTabixAdapter` dropped the
  strand + srcSize fields** of each species entry (`assembly.chr:start:size:`
  **`strand`**`:`**`srcSize`**`:seq`), so every row defaulted to `+` — broke this
  indicator and `−`-strand hover coordinates. Now parsed via the pure, tested
  `parseMafTabixEntry`. NOTE: jbrowse-web bundles plugins from `src` (not `esm`;
  esm is publish-only), but `tsgo --build` emits esm — irrelevant to the running
  app. Screenshot (`maf_inversions`): the ce11 subset's only inversion is small
  (bruMal2 forward blocks, 87 bp), so the figure filters to a few species
  (`subtreeFilter`) at a tall row height. **Sidebar-occlusion gotcha:** the rows
  canvas spans the full view width with the tree sidebar drawn *over* its left,
  so a feature at the far-left genomic edge renders *under* the sidebar and looks
  missing — frame the locus so the feature of interest sits past the sidebar.

## NCBI MCGV / CGV (researched 2026-06-28)

CGV = pairwise whole-genome assembly-assembly viewer (~800 alignments, 350+
species); **MCGV** (beta, Jan 2025) extends it to *multiple* genomes vs one
**anchor** (default human GRCh38.p14). Alignment sources are community/multi:
Ensembl EPO, T2T 8-ape, VGP 137-bird, in-house Progressive Cactus. Rendering is
WebGL (d3/pixi). Sources: PMC11101090 (PLoS Biology, doi:10.1371/journal.pbio.3002405),
ncbi.nlm.nih.gov/mcgv/cm/mcgv/help.

**Anchor model (not pairwise chaining).** Every assembly aligns to one anchor;
"find gene on anchor → all rows follow." An all-vs-anchor MAF *is* anchor-shaped,
so our reference-anchored MAF already matches this. Borrow: put the anchor at row
0, gene search keyed to anchor coords.

**Explicit LOD tiers (directly transferable thresholds):**
- chromosome overview = count of assemblies aligned per fixed bin (~100 kb)
- assembly-alignment blocks (a "compressed" mode = 1 row/assembly)
- **sequence conservation track appears below ~1 Mb** (proportion matched to
  anchor: dark blue = matched, light blue = divergent)
- per-nucleotide letters at max zoom

Our MAF is always per-base → slow/huge on a UCSC bigMaf. The summary path
(bigMafSummary bars) is our tier-1; the gap is the mid-tier conservation/identity
LOD. See "Tiered MAF (LOD)" in OTHER_IDEAS.md.

**SV / rearrangement display.** Neither tool *classifies* SV types; structure
emerges visually:
- dotplot: forward = green positive-slope, inversion = purple opposite-slope
- duplications = multiple / non-reciprocal-best alignment segments (toggle)
- deletions/CNV = gaps in otherwise-syntenic regions
- MCGV "color by chromosome" = coverage-rank shading; in compressed 1-row mode
  this surfaces large translocations/inversions without explicit SV calling
- MCGV "color by identity" shades each segment by % identity to anchor
- per-position **conservation table** (matches/mismatches/gaps/insertions),
  drill-down to which assemblies contribute each count

**Gene display.** Genes = green bars; a **jagged edge** marks an annotation
extending past the aligned region; type-ahead gene search; navigating to a gene
synchronously jumps every row to the orthologous (aligned) location.

## Rendering SV differences IN a MAF (design)

A reference-anchored MAF already carries rich SV signal that we currently only
surface in tooltips. Each `MafAlignedRow` carries `chr`, `start`, `strand`,
`srcSize`; `MafEmptyRow` carries a `status` (UCSC e-line: C/I/N/n/M/**T**). The
worker output is absolute genomic uint32 already. Candidate features, cheapest
first:

- **Color-by-source-chromosome mode (MCGV-style, recommended first).** Color each
  species' block by a hash of its `row.chr` (+ a "distant/discontinuous" test on
  `row.start` vs the previous block on that row). A species whose aligned blocks
  across the reference window come from different source chromosomes → the row
  changes color → instant translocation/rearrangement flag. Zero new fetch
  (`chr`/`start` already shipped); it's a new GPU/Canvas color mode + legend,
  analogous to the row-identity modes. This is the single highest-leverage SV
  view and maps onto the existing per-row rendering scaffold (`activeRowRendering`).

- **Inversion (strand-flip) indicator.** Mark a block whose `row.strand` differs
  from that species' dominant/reference strand (hatch or underline). Inversions
  are the clearest SV and `strand` is already present per row.

- **Rearrangement markers at block junctions.** Between adjacent blocks on one
  species row, if coords are non-collinear (chr change, large jump, order
  reversal), draw a small breakpoint marker on that row at the junction, colored
  by type — the per-species analog of the alignments split-read breakpoint logic.

- **SV-relevant e-line status.** We already parse `T` (tandem dup), `I` (inserted
  seq between), `N`/`n` (new scaffold). Today all e-lines draw as bridge lines;
  give `T`/`I`/`N` distinct decoration so duplications/insertions/scaffold breaks
  read visually, not just in the tooltip (`describeMafStatus` already names them).

- **Large-indel emphasis.** Existing insertion/deletion overlays draw counts;
  promote indels above an SV-scale threshold to a distinct style so SV-scale
  events stand out from single-base ones.

Don't fight the reference axis for true non-reference structure (a species'
insertions have zero reference width) — that's the argument for the MSA-extract
bridge (T3) and/or a synteny/dotplot companion view, per OTHER_IDEAS "Linked
dotplot + linear synteny" and "Explicit SV-type classification".

## Next concrete steps (ranked)

1. **Mid-tier conservation/identity LOD** for large bigMaf (MCGV's ~1 Mb tier):
   a "matched-to-anchor proportion" track between the per-base detail and the
   bigMafSummary bars, so a genome-scale multiz isn't always per-base.
2. **Rearrangement markers at block junctions** — the per-species split-read
   analog (chr change / large jump / order reversal between adjacent blocks on a
   row), building on the now-correct per-row `chr`/`start`/`strand`.
3. **react-msaview extract bridge (T3)** — the honest answer to non-reference
   structure (a species' own insertions have zero reference width on the MAF
   axis); spans the `~/src/react-msaview` repo.

Stitching note: cross-exon stitching is done but only joins exons that share a
fetched MAF block. If a future need arises to stitch across MAF block boundaries
(adjacent exons in different blocks), it requires a region-wide ref-position →
(block, column) index rather than the current per-block `refColumns`.
