# R script export — handoff

"Export R script" (LGV view menu) downloads a self-contained `.R` that redraws
the current view from source in pure **`rtracklayer` + base `ggplot2`** (no
bespoke package). This is the working handoff for extending it; the *design
record* lives elsewhere and is not duplicated here:

- **User-facing guide:** `website/docs/user_guides/r_export.md`
- **Per-track design notes + rendered examples:**
  `website/static/img/rexport/README.md` (the gallery — one section per track
  type, each figure genuine `assembleRScript` output).
- **The code** is the source of truth for behavior.

## Non-negotiable design decisions (do not reverse without asking)

- **No bespoke package.** An earlier `ggjbrowse` attempt was rejected: wrapping
  logic in a package makes the emitted script a black box a user (or assistant)
  can't tweak with ordinary ggplot2 knowledge. Everything is emitted as small,
  visible inline helper functions instead.
- **Not pixel-perfect, by design.** Idiomatic R that shows the same data beats
  matching JBrowse's exact rendering. Row packing uses `IRanges::disjointBins`,
  colors approximate the canvas palette, etc.
- **A TS→R transpiler was considered and rejected** (non-idiomatic machine R,
  fights hackability).

## Architecture

- `plugins/linear-genome-view/src/LinearGenomeView/exportR.ts`
  - `HELPERS`: the inline R helper defs table; only helpers a fragment
    references are emitted (deduped, stable order). Add new readers/layout
    helpers here.
  - `assembleRScript(region, fragments)` (re-exported from the plugin index):
    pure codegen — emits `library()`s, deduped helper defs, per-track setup,
    `plot_region()`, the current-view call, the batch-BED-loop comment. Also
    handles refname aliases (`resolve_chrom`) when a fragment carries a
    `refNameMap`.
  - `collectFragments` iterates every track's `display.exportRCode` and attaches
    each track's canonical→file-name `refNameMap`.
- `plugins/linear-genome-view/src/LinearGenomeView/rexportShared.ts`: shared
  codegen primitives — `rStr` (R string literal), `rName` (backtick name),
  `safeVarName`, `firstUri`, `getTrackRMeta` (the per-display preamble reading
  trackId/trackName/adapter).
- `RTrackFragment` (`types.ts`, re-exported): one stacked panel =
  `{ trackId, trackName, packages, helpers, setup, plotVariable, plotExpr,
  heightWeight?, refNameMap? }`. `plotExpr` references `chrom`/`start`/`end`
  from inside `plot_region()`.
- Per-display `plugins/*/src/*Display/exportRCode.ts`: a pure `xFragment(params)`
  builder (what the unit tests hit) + `exportRCode(self)` reading the model. The
  model wires an `exportRCode(): RTrackFragment` method with an **explicit return
  type** (breaks the self-referential MST model-type cycle, same as `renderSvg`).

## Adding a track type (recipe)

1. Add any reader/layout helper to `HELPERS` in `exportR.ts`.
2. In the display plugin add `exportRCode.ts`: a pure `xFragment(params)` builder
   + `exportRCode(self)` reading `getTrackRMeta(self)`'s adapter uri + resolved
   styling. Return `RTrackFragment` (or `RTrackFragment[]`).
3. Wire an `exportRCode(): RTrackFragment` model method (**explicit return type
   required**). Import `RTrackFragment` from `@jbrowse/plugin-linear-genome-view`.
4. Add `exportRCode.test.ts` (codegen string checks) + `exportRRun.test.ts` (runs
   the real `assembleRScript` output through `Rscript`, `test.skip` when R deps
   absent).

## What's shipped (pointers, not detail)

wiggle, multi-wiggle, alignments (BAM/CRAM), genes (GFF3 + BED), variants,
multi-sample variant matrix + rows, Hi-C, GWAS. Alignments is the richest: SNP
coverage, color-by schemes, MD-tag mismatches, MM/ML modifications, per-base
quality, soft/hard clips, CIGAR indels, linked reads, center-line **sort**
(position/strand/base — base sorts a deletion over `sort_pos` as `*`, ahead of
the ACGT bases, matching JBrowse), and **Filter by** (flags/read-name/tags). See
the gallery README section per type.

## Next steps (prioritized)

- **Interbase/tag sorts.** `sorted_pileup_layout` falls back to plain layout for
  `insertion`/`softclip`/`hardclip`/`tag` (`resolveSortType` returns undefined).
  `softclip`/`hardclip` reproducible from `bam_clips` (clip length at `sort_pos`,
  longest first — JBrowse `desc=true`); `insertion` from `bam_indels`
  (`type=="I"`); `tag` needs a per-read tag read (like `read_filter`'s tag path).
- **Coverage-panel filtering.** `read_filter` is applied to the pileup only; the
  SNP coverage panel (`bam_coverage`/`bam_mismatches`) still counts all reads.
  JBrowse's SNP coverage respects the filter. Would need flag/tag filtering inside
  `bam_coverage` (currently `coverage(ga)` over everything).
- **Bisulfite / 5mC-5hmC methylation.** `bam_modifications` handles MM/ML modBAM
  but not reference-dependent bisulfite C→T (no MM tag), the 5mC/5hmC
  winner-take-all collapse, or `shownModifications`/`hiddenModifications` per-type
  filtering (all types currently render).
- **Gene-label declutter** (avoid a `ggrepel` dep; maybe only label top-level).
- **Phased-HP PS hue.** Phased genotype export flattens phase-set (`PS`) coloring
  to the flat mfa/secondary color instead of a per-phase-set hue.
- **Multi-wiggle pos/neg bicolor split** isn't reproduced (signed data colors by
  source only); group/cluster tree order isn't reflected.

## Verification (the real accuracy technique)

`Rscript` is installed in this env with ggplot2, patchwork, rtracklayer,
GenomicRanges, GenomicAlignments, Rsamtools, strawr; `samtools` is on `PATH`
(CRAM only). The `exportRRun.test.ts` files execute the *actual* generated script
against `test_data/volvox/*` — this catches real bugs codegen string checks miss.
Pattern: build a script with `assembleRScript`, run it, assert the figure exists,
then a second `probe.R` (helpers split on `# Data sources`) that calls one helper
and asserts a known biological fact (e.g. the ctgA:1693 C-SNP, the RG:Z:4 200-read
split in `volvox-rg.bam`).

**Regenerating a gallery figure:** a throwaway `*.gen.test.ts` (see git history
for the sort figure) that builds the script and runs it to
`website/static/img/rexport/<name>.png`, then delete the test.

## Gotchas

- **`read_index` join is index-based.** Every alignment overlay (`bam_mismatches`,
  `bam_modifications`, `bam_clips`, `bam_indels`, `bam_base_quality`) emits a
  `read_index` = position in `readGAlignments` order, joined via
  `reads$row[x$read_index]`. **Do not drop rows from `reads`** — it desyncs the
  join. `read_filter` marks a `keep` column instead; the layout leaves filtered
  reads at an **NA row** and ggplot omits them (bodies and overlays vanish for
  free). Any new per-read filtering must follow this.
- **GRanges has no `[[`** — read metadata columns via `mcols(g)[[nm]]`.
- **Model-type cycle** — annotate `exportRCode()`'s return type explicitly.
- **CRAM** — Rsamtools can't read CRAM (deliberate upstream gap, no dep bump
  fixes it). Each panel decodes the region to a temp BAM via `cram_to_bam`
  (samtools), which restores MD so `bam_mismatches` still works.
- **Shared worktree** — multiple agents edit these files. Stage explicit
  pathspecs when committing; never `git add -A`. (The former `agent-docs/
  R_EXPORT.md` + `R_EXPORT_ADVANCED.md` were deleted by another agent's commit
  `0be12eb49d`; this doc replaces them, lean and next-steps-focused.)

Relates to the memory `[[project-r-export-alignments-sort]]`.
