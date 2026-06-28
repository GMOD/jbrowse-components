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

1. **Codon translation per species** (in progress; UCSC `wigMafTrack.c`
   `translateCodons` is the reference algorithm — translate each species in the
   anchor reading frame from `mafFrames`, AA letter centered on each codon, with
   alternating codon shading; `codonDefault` = use one anchor species' frames for
   all rows). Enables eyeballing amino-acid changes across species; syn/nonsyn
   coloring falls out once per-species AAs vs anchor AA are known.
2. **Color-by-source-chromosome SV mode** (above) — MCGV's most borrowable idea,
   fits the existing per-row rendering scaffold.
3. **Mid-tier conservation/identity LOD** for large bigMaf (MCGV's ~1 Mb tier).
