---
status: Accepted
summary: "A display declares a mark list — a shape (one hand-written shader, one packer, one Canvas2D painter that is also the SVG export, one hit test) bound to its payload by two lenses — and `createMarkBackend` derives both backends from it. Thirteen in-tree displays draw that way and the third-party gauge now does too, which un-rejects the render half of ADR-090 that ADR-091 removed with the factory; the factory stays rejected. Records the ladder with four rungs, what the mark layer deliberately does not hold, and that `defineMark`'s option set is third-party ABI"
---

# ADR-106: A display declares its marks

## Status

Accepted (2026-09-09). Amends
[ADR-090](adr-090-a-mark-is-a-shape-plus-its-channels.md),
[ADR-091](adr-091-a-displays-settings-are-a-declaration.md) and
[ADR-095](adr-095-a-shape-composes-a-scale-at-compile-time.md), each of which
says the mark system was removed. ADR-091's rejection of the `defineDisplay`
factory and of a declared settings table stands untouched; its "what would
reopen this" clause still governs a replacement for the display stack.
[reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"Shared
per-region streamed contract" and `packages/render-core/CLAUDE.md` §Upload and
§Drawing are the operational docs; this file holds the decision and the record
those three ADRs lack.

## Context

ADR-091 reverted ADR-089 and ADR-090 together on 2026-08-24, and measured only
the factory: the port of Manhattan needed six override hooks, the settings table
eliminated no getters, and the spec form loaded the HAL at plugin install. The
mark (`{ type, ...channels }` on a spec) went with it unmeasured, because it was
a field of the spec.

Between 2026-09-04 and 2026-09-08 the render half came back in a different
form, without a factory, one display at a time: `packages/render-core/src/marks/`
(`1c9d999679` Manhattan through the point shape, `60b9f3639f` MAF's rows band,
then variants, the variant matrix, the canvas feature glyphs, the coverage band
shared by alignments and MAF, HiC, LD, dotplot, both synteny displays, wiggle
and the arc band). By 2026-09-08 thirteen displays declared marks, both
per-plugin renderer classes were gone from every one of them, and the
2026-09-05 review's handoff had closed with the boundary rule stated in
render-core's CLAUDE.md. No ADR recorded any of it: a reader of the decision
records concluded the opposite of what the tree does, and the third-party
gauge, `example-plugins/score-example`, still carried its own shader, two
renderer classes and a factory, which is what the developer guides taught.

## Decision

**A display declares a mark list.** A `MarkShape` is one hand-written `.slang`
with its generated packer, one `writeUniforms`, one `paintBlock` over the same
channels, and optionally `hitNearest` and `paintsBlock`. `defineMark` binds a
shape to a display's payload through two lenses — `channels(region)` picks the
typed arrays, `params(state, region, block)` picks what reaches the uniforms —
plus `band`, `bufferOf` and `texture` where a display stacks bands, borrows a
buffer or samples a ramp. `createMarkBackend(canvas, marks)` is both backends;
`paintMarkBlocks` is the SVG export; `drawAgainstHit` is the sweep that holds a
shape's hit test to its painter.

What differs from ADR-090's mark, and why it held where that did not:

- **No spec and no factory.** A display composes its own MST chain and calls
  `createMarkBackend` from its lazy component. ADR-091's objection — a
  declaration that needs a function-valued option per display concept has
  stopped being a declaration — does not reach a declaration that holds only
  the drawing. The drawing was the healthiest layer in the 2026-08-24 census
  and the one a declaration fits.
- **The lens is a pick, never work.** ADR-090's channels were accessors per
  channel; `channels` names which arrays feed which lanes, once per block per
  frame, and the encode from data to channels stays the display's. The seven
  ways the 2026-09-05 review proposed moving encode, geometry or the diff across
  that boundary were declined and are listed in render-core's CLAUDE.md.
- **Eager cost is gone.** ADR-091's surviving constraint — a state model is
  eager, so a registration loads what it names — dissolved on 2026-09-02 when
  `DisplayType.stateModel` took a loader. `marks/backend` is the one subpath
  that reaches the HAL and only a lazy component imports it.
- **A shape lives where its consumers are.** `span`, `point` and `bar` are
  render-core's; variants' `cellMark`, the canvas glyph set, wiggle's four and
  the coverage band's five stay in their plugin beside the generated twins
  their hit tests read. The admission bar is ADR-040's. `bar` cleared it on
  2026-09-09 with the config-authored mark display as its consumer and the
  published contract as the second ([ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md));
  `valueScale.slang` is the y scale it shares with `point`, per ADR-095.
- **A frame plan, for a list whose gates are display-wide.** `defineMark`
  takes `enabled(state)`, honoured by draw, paint and hover alike;
  `planMarks(marks, state)` resolves a list once per frame and
  `drawPlannedPasses` is one `drawPass` per planned mark with no lens, gate or
  write. The thirteen `drawMarks` consumers are unchanged. It exists because the
  pileup's per-block walk had been measured at 1.29x and the plan walk measures
  at 0.46x of today's loop (`benches/pileupUniformWrite.bench.ts`, 2026-09-09).

**The mark layer is the published GPU path.** `example-plugins/score-example`
declares a plugin-local shape over its own `score.slang` and one `defineMark`,
and the developer guides teach that form. A third party gets WebGPU, WebGL2,
Canvas2D, SVG export and a hit test from one declaration, and writes a shader
only for a shape the library lacks. The consequence is stated rather than
hidden: once the packed-tarball job imports `@jbrowse/render-core/marks` and
`marks/backend`, `defineMark`'s option set — `shape`, `channels`, `params`,
`band`, `bufferOf`, `texture` — and `MarkShape`'s members are third-party ABI.
An option is added to that set on a second in-tree consumer's pull, the way
the shapes are.

## The ladder, restated

ADR-095 stated the grammar position as three rungs. It has four:

| Rung | Position | Evidence |
| --- | --- | --- |
| authoring: a reader picks a mark and wires channels | refused for the general case; **reopened for the quantitative class** | SESSION_SPEC_FORMAT.md §Assessment; the BED adapters' `scoreColumn`, and a `FeatureTrack` over `BedTabixAdapter` with a `LinearManhattanDisplay` or `LinearWiggleDisplay` already painting from config (verified 2026-09-09) |
| display and settings: a declared table the schema, fetch key and state derive from | refused, on measurement | ADR-091 |
| **the mark: drawing, hit test and export from one declaration** | **adopted** | this ADR, thirteen displays |
| encoding: a shape composes a scale and a ramp at compile time | adopted | ADR-095 |

The two rungs the tree refuses and the two it adopts split on the same line:
what a declaration can hold is the drawing and the shader's composition; what it
cannot is layout, tiering, fetch shape and per-display meaning.

## What the mark layer deliberately does not hold

- **The alignments pileup, for now.** `plugins/alignments/src/features/mark.ts`
  is a second mark system over the same word, data-coded for a walker over ten
  marks. The 2026-09-05 measurement that kept it out is answered by the frame
  plan above, so the fold is unblocked; the conversion itself is parked on the
  branch `wip/pileup-marks-conversion` (production code typechecks, ~15 test
  files still reference removed signatures) and
  `ideas/one-mark-declaration-per-feature.md` lists what remains. The arc and
  coverage bands in the same plugin are on render-core's marks.
- **Text.** Every label is an overlay canvas painted by a per-display function
  that the export calls unchanged; `INTERACTION_PERF.md` measured that a
  `fillText` inside the frame loop flushes style recalc, and the positioned-label
  overlay is `OverlayCanvas` plus `Ctx2D`, already built.
- **Scales as a slot on `defineMark`.** ADR-097 measured the refusal; the y
  scale is shared at the shader level and the anchor is per consumer. The
  colour scale a display resolves is declared one level up, on the display, as
  `colorScales` ([ADR-108](adr-108-a-display-declares-its-colour-scales.md)).
- **Layout.** Placement stays imperative and per display, as ADR-095 records.

## Consequences

- ADR-090's "the worked example needs no shader of its own" is true only where
  a shared shape fits; the example keeps its shader as a plugin-local shape and
  the guide says when `span` or `point` would have done. Measured on
  2026-09-09: the example went from 664 hand-written lines across 16 files to
  837 across 15. The render half is the same size (289 against 286) and the
  growth is a hit walk (71) and an SVG export (70) it did not have; what the
  declaration buys a plugin with a shape of its own is hover, export and the
  draw-against-hit gate, not lines. The shrink belongs to the config-authored
  form ADR-107 describes, where the same bars are one `marks` entry.
- A display that still writes a `GpuXxxRenderer` / `Canvas2DXxxRenderer` pair
  is the exception the reference doc names, and a new one needs an argument.
- The channel vocabulary is not yet one: `span` and `point` say `x`/`x2`/`row`,
  variants' `cell` says `startEnd`/`rowIndex`, canvas's `rect` says
  `startEnd`/`y`/`height`. Converging it is a lens change per display, not a
  shape change, and is the next small move on this layer.
- The encoding — features to typed arrays — is the half of a grammar the tree
  still hand-writes per display (`buildScoreResult`, `buildManhattanResult`,
  canvas's `packRenderArrays`). Field selection there stays native: gwas
  measured jexl at ~0.34M values/s against ~390M native
  (`plugins/gwas/src/GWASAdapter/scoreTransforms.ts`). A declared encoding is
  field names with jexl as the escape, which is the form Manhattan's `color`
  already takes.

## Rejected alternatives

- **Put the example on `bar` and delete its shader.** The example is the
  plugin-local form on purpose: a third party with a shape the library lacks
  needs exactly that path, and the config form covers the bars.
- **Fold the pileup's `PileupMark` into `MarkShape` in the same pass.** The
  mechanism landed and measured; the conversion is a 46-file change parked
  behind its parity suites rather than landed red.
