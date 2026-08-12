# plugins/wiggle

Two displays (`LinearWiggleDisplay`, `MultiLinearWiggleDisplay`) over one
shader, one Canvas2D twin and one hit test, all in `src/shared`. The scale, axis
and score machinery is a package rather than a directory —
`packages/wiggle-core` — because six other plugins draw a wiggle-shaped axis
against it (gwas's Manhattan, alignments' coverage, maf, variants, hic). A rule
about a **score** or a **y-axis** usually belongs there; a rule about how a bar
is painted belongs here.

## The two displays differ in exactly one thing: the vertical inset

Single-wiggle reserves `YSCALEBAR_LABEL_OFFSET` above and below its plot so the
top and bottom axis labels aren't clipped. Multi-wiggle stacks rows edge-to-edge
over the full height, for density.

That is **one** decision with two halves, and they must move together:

- the render height (`axisPlotBox(height).plotHeight` vs bare `self.height`),
  and
- the offset `computeYTicks` places itself in (default vs `offset: 0`).

`axisPlotBox` exists so both halves read one function. Split them and the ticks
label their own data wrong — which is the failure that matters, because the axis
is what a reader believes. `WiggleFamilySvgFrame` bakes the single-wiggle inset
in, which is why multi keeps its own SVG body and why both carry a "don't unify"
comment. Parameterize the inset first if you ever do.

## `viewportWidth` is CSS px — `clip.scissorW`, never `clip.pxW`

`canvasHeight` is CSS px, and `wiggle.slang` mixes the two axes freely: `hwx`
converts the step-line's half-width through `viewportWidth` while `hwy` converts
it through `canvasHeight`, and the centre-line capsule builds `dxPx` from one
and `dyPx` from the other. Feed a device-px width and at dpr 2 the
`MIN_FILL_WIDTH_PX` floor halves, the step-line stroke goes half as wide as it
is tall, and the capsule shears. `gpuWiggleRenderer.test.ts` pins it.

`GpuMafRenderer` writes `clip.pxW` into a uniform of the same name in a
different shader, deliberately and with its own note saying the question of
MAF's floor is unresolved. The two are not interchangeable and neither one is a
precedent for the other.

## The min-width floor is shared, the fudge is not, and the anchor is shared

Three separate decisions that all look like "how wide is a bar":

- **The floor** is `MIN_FILL_WIDTH_PX`, `//! export-consts`ed out of
  `wiggle.slang` (adr-051) and re-exported here as `WIGGLE_MIN_PX`. One number,
  both backends. It was a `1.5` on each side with a comment on each naming the
  other, which is what a shared constant looks like until one of them moves.
- **`WIGGLE_FUDGE_FACTOR` (0.8px) is Canvas2D-only and deliberate.** A
  `fillRect` at fractional coordinates antialiases its own edges, so adjacent
  histogram bars leave hairline gaps; adjacent GPU quads sharing an exact edge
  on a multisampled target do not. So the two backends' bar _widths_ differ by
  sub-pixel amounts by design, and the shader must not grow a fudge to match.
- **The anchor is shared and is not sub-pixel.** Both backends grow a floored
  bar away from the bin's **start** — `spanLeft` here, `extendToMinWidthX` in
  the shader. Anchoring the leftmost edge instead is identical on a forward
  block and wrong by a whole floor on a reversed one; see the reversed-block
  family in `packages/render-core/CLAUDE.md`, which wiggle is a member of.

## `makeScoreNormalizer` is the one `js-export` twin that does **not** retire

Everywhere else, a generated scalar replaces its hand-written twin. Here both
stay: `makeScoreNormalizer` is a factory that hoists the log arithmetic out of a
per-feature loop, and `normalizeScore` from `wiggle.js.generated.ts` is per-call
scalar. The generated one is kept as an **oracle** —
`normalizeScoreParity.test.ts` sweeps them against each other over domains the
app can actually reach, so the branch a reader compares against is the branch
the GPU runs.

It earned that slot by drifting: both floored the log domain at 1, which made a
domain sitting entirely under 1 (mappability, a methylation fraction, any
normalized ratio) normalize to a flat baseline, and the fix had to be
hand-written into `normalize.ts` and `wiggle.slang` with nothing checking they
agreed. The floor is the domain's **own min**, not 1.

`scoreToY` is `//! js-skip`ed rather than exported for the one place the two are
allowed to disagree: a degenerate (`min === max`) domain, where JS returns 0 and
the shader divides by an epsilon to avoid NaN. That is a product decision nobody
has taken; the parity test states it as an expectation so it can't drift
further.

## `rowIndex` is the position in the display's own `sources`, never the payload's

`buildSourceRenderData` iterates the display's visible list and stamps `i`, so a
source missing from the RPC payload leaves its row empty instead of shifting
every row below it. Overlay collapses every source onto row 0.

Two things read that number back and both must agree with it:

- `findRowHit` picks `visibleSources[floor(offsetY / rowHeight)]`, so
  `effectiveRowHeight` has to equal the renderer's
  `getRowHeight(canvasHeight, numRows)` — it does, in both overlay (`height`, 1
  row) and row mode (`height / numSources`).
- `numRows` is floored at 1 in `makeWiggleRenderState`, because the shader's
  bare `canvasHeight / numRows` divides whatever the instance count is and would
  seed the row transform with Infinity.

Falling back to the payload's source list when the display's is empty painted
its first source full-height underneath the "no subtracks match" message, which
is what a subtree filter matching nothing means.

## Three gap rules, each with exactly one owner

A hole in the data means something different per rendering mode, and each rule
is written once and read by both backends:

- **Step line** breaks on bp adjacency. The encoder writes `prevScore`/
  `nextScore` from `prevAdj`/`nextAdj`; `drawLine` derives the same thing as
  `inRun`/`gapAfter`. `0` is the gap sentinel _and_ a legal score, which is
  harmless only because a feature scoring 0 draws the same either way — don't
  add a rule that reads them apart.
- **Interpolated line (`linecenter`)** connects consecutive pairs regardless of
  adjacency, because reduced BigWig data is full of sporadic non-tiling bins.
  Only a hole past `gapLimitBp` breaks it, and that number is computed **once
  per layer** in `buildSourceRenderData` and read by both the encoder (which
  writes `NO_PREV_START`) and `drawLineCenter`. Measured in **bp, not px** — a
  px comparison drifts from the encoded break wherever a block is clipped.
- **`DEFAULT_GAP_BREAK_MULTIPLE` is 0, i.e. off**, after having shipped at 20.
  The mechanism stays whole because setting `maxGapMultiple` is the only way
  back; see `gapBreak.ts` for why the number was retired and not the feature.

## The summary mode that reaches the GPU is not the one that reaches the fetch

`effectiveSummaryScoreMode` resolves whiskers to `avg` under density, which has
no whiskers presentation. The autoscale domain, the track menu's radio, the
tooltip and `gpuProps` all read that resolved value, so they agree about what is
on screen.

`rpcProps` deliberately carries the **raw** slot instead. The effective one
moves when the rendering type moves, and anything in `rpcProps` invalidates the
fetch — so switching to density would discard every loaded region and
re-download it. Over-fetching min/max in density-with-whiskers is the cheaper
mistake.

`bicolorPivot` crosses in _both_ directions for the same kind of reason: the
worker owns the `avg`-path pos/neg split (ADR-016, so it is a fetch input),
while the whiskers bands are colored on the main thread and need the same
threshold in `gpuProps`.

## Whiskers splits into solid layers only when the bars nest

`isDensityMode || (isFilled && bands.length > 1)` partitions each band into
solid-color pos/neg layers and orders them back-to-front — largest magnitude
first, which is the _opposite_ order on the two sides of the pivot, and is why a
single band order can't express it. Density needs the split because
`drawDensity` builds one gradient per layer and has no per-instance path.

Everything else keeps the band whole and colors per instance. A lone filled band
is in that group: its pos and neg bars grow away from the pivot in opposite
directions and never overlap. Splitting line or scatter modes would break line
continuity at every pivot crossing.

## The shipped arrays are aliased. Read them; never write into one

`processFeaturesFromArrays` aliases rather than copies wherever a copy would be
identical — `featureMinScores`/`featureMaxScores` **are** `featureScores` when
the data carries no summary variation, and an all-positive window's `pos*`
arrays **are** the full arrays. That is what keeps a typical coverage source
from allocating, filling and transferring three redundant copies of its
positions; structured clone preserves the sharing across the RPC boundary and
`collectWiggleTransferables` dedupes the buffers.

It is safe only because every consumer reads. A pass that normalizes or clamps a
band in place would silently rewrite the average scores under every other reader
of the same source.
