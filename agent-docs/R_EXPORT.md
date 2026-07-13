# R script export

"Export R script" (LGV view menu) downloads a self-contained `.R` file that
reproduces the current view. Committed in `04c4cd49f9`.

## Product shape (what the emitted script is)

Pure **`rtracklayer` + base `ggplot2`** — no bespoke R package. The script is a
loopable `plot_region(chrom, start, end)` function that reads each track from
source and stacks one ggplot panel per track with patchwork; the current view
is one call and a commented BED loop shows batch use. `start`/`end` are 0-based
half-open (BED-style).

**Why no package** (decided with the user, do not reverse without asking):
wrapping the logic in a package (an earlier `ggjbrowse` attempt) makes the
emitted code a black box — a user, or an assistant editing the output, can't
tweak it with ordinary ggplot2 knowledge. Everything the script needs is emitted
as small **visible inline helper functions** instead. Also: **not pixel-perfect**
by design — idiomatic R that shows the same data beats matching JBrowse's exact
rendering. A TS→R transpiler was considered and rejected (emits non-idiomatic
machine R, fights the hackability goal, and its only win — perfect layout sync —
is moot since we're not pixel-perfect).

## Architecture

- `plugins/linear-genome-view/src/LinearGenomeView/exportR.ts`
  - `assembleRScript(region, fragments)` (exported from the plugin index) —
    the pure codegen entry: emits `library()`s, the deduped inline helper defs,
    per-track file-path vars, `plot_region()`, the current-view call, and the
    batch-loop comment. `exportR(model)` is the thin download wrapper.
  - `HELPERS` table: inline R helper defs (`read_bigwig`, `read_bam`,
    `read_gff`, `bam_coverage`, `pileup_layout`, `gene_layout`, `bp_axis`);
    only the ones a fragment references are emitted.
- `RTrackFragment` (LGV `types.ts`, re-exported from the plugin): one stacked
  panel = `{ packages, helpers, setup, plotVariable, plotExpr, heightWeight }`.
  `plotExpr` references `chrom`/`start`/`end` from inside `plot_region()`.
- Per-display `exportRCode(self)` model method returns a fragment (or
  `RTrackFragment[]` for multi-panel tracks); the view iterates every track's
  `display.exportRCode` and `collectFragments` flattens arrays. Each display
  also has a pure `*Fragment(params)` builder that is what the unit tests hit.

## Track types done

| Track | Display | R approach |
| --- | --- | --- |
| wiggle | `LinearWiggleDisplay` | `geom_rect` (solid), `geom_step` (line), `scale_fill_manual` on `score >= pivot` (bicolor), viridis strip (density) |
| alignments BAM/CRAM | `LinearAlignmentsDisplay` | coverage `geom_area` panel + strand-colored `geom_rect` pileup panel; rows from `IRanges::disjointBins` (not JBrowse's `placeRect`) |
| genes GFF3/BED | `LinearBasicDisplay` | `geom_segment` bodies + `geom_rect` leaf exons/CDS; `gene_layout` groups by top-level parent then `disjointBins` |

Every panel ends with `coord_cartesian(xlim = c(start, end))` so stacked tracks
share one x-range (features/reads overhang the fetch region; without this the
panels don't vertically align).

## Adding a track type (recipe)

1. Add any new reader/layout helper to `HELPERS` in `exportR.ts`.
2. In the display plugin add `exportRCode.ts`: a pure `xFragment(params)`
   builder + `exportRCode(self)` that reads `getContainingTrack(self)`'s adapter
   uri and resolved styling. Return `RTrackFragment` (or `[]`).
3. Wire an `exportRCode(): RTrackFragment` model method (**explicit return type
   is required** — it breaks the self-referential MST model-type cycle, same
   trick as `renderSvg`). Import `RTrackFragment` from
   `@jbrowse/plugin-linear-genome-view`.
4. Add `exportRCode.test.ts` (unit) + `exportRRun.test.ts` (runs the real
   `assembleRScript` output through `Rscript`, skips if R absent).

## Verifying (the real accuracy technique)

`Rscript` **is installed in this environment** with ggplot2, patchwork,
rtracklayer, GenomicRanges, GenomicAlignments, Rsamtools — **but NOT
VariantAnnotation** (so variants can't be tested here yet). The
`exportRRun.test.ts` files execute the actual generated script against
`test_data/volvox/*`; run them locally. This is what catches real bugs
(execution, not just codegen string checks) — e.g. it caught `g[[nm]]` failing
on a `GRanges` (must use `mcols(g)[[nm]]`; GRanges has `$` but no `[[`).

## Gotchas

- **GRanges has no `[[`** — read metadata columns via `mcols(g)[[nm]]` (the `$`
  accessor works but `[[` does not).
- **Model-type cycle** — annotate the `exportRCode()` method return type
  explicitly, else `tsc` reports a circular self-reference.
- **Shared worktree** — multiple agents share this tree. Stage explicit
  pathspecs when committing; don't sweep up unrelated changes.

## Next

- Variants (`VariantAnnotation` — install to test; VCF → lollipop/`geom_point`
  or box).
- CRAM reference resolution (emits the same `read_bam`; untested — needs the
  reference FASTA/2bit).
- Pileup mismatch coloring + `colorBy` fidelity (currently strand only).
- Gene label de-clutter (avoid a ggrepel dep; maybe only label top-level).
- Multi-wiggle (`MultiLinearWiggleDisplay`) has no `exportRCode` yet.
