---
status: Accepted
summary: "A per-instance scalar's vertical position is a shared scale and a per-consumer anchor, stated over the six live shader arms that plot one. The scale half already factored — scoreScale.slang has three importers and its JS twin is the oracle two parity suites sweep against — and the anchor half does not: four candidate unifications each trip a measured kill condition, including a Manhattan degenerate domain that moves a pinned cross-backend value by the full canvas height. Describes what the tree does and proposes nothing; the declined composition step is the REJECTED_IDEAS entry this links"
---

# ADR-097: The y channel shares its scale and not its anchor

## Status

Accepted (2026-08-29). This ADR describes what six live shader arms already do;
it proposes nothing and carries no gate — a description of the tree cannot fail.
The composition step the census was run to justify was declined on measurement,
and its entry is in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) §"Rendering and
displays".

It is the y-axis counterpart to
[ADR-094](adr-094-colour-cardinality-is-one-channel-not-four-shapes.md), which
ran the same census on colour, and it reaches the same shape of answer on
different evidence: one half of the encoding factors and the other must not.
[ADR-095](adr-095-a-shape-composes-a-scale-at-compile-time.md) is where the
scale half actually landed — this file states the rule that landing left
implicit, and records that the axis has no second composition owing.
[ADR-040](adr-040-no-genome-quad-vertex-helper.md) (two real consumers,
non-obvious math, no parameter with a single caller) and
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md) (codegen is scalar-only,
shaders stay hand-written) both stand and are the two rules that decided the
refusals below.

## Context

Six shader arms map a per-instance scalar to a vertical position, and the census
(measured 2026-08-29, every citation verified against the current file) is what
they spell:

| Shader | y is | Spelled |
| --- | --- | --- |
| `wiggle.slang` xyplot | a per-instance scalar **and** a per-frame origin through a shared scale, as the two cuts of a bar | `float score : ATTR1` and `u.origin`, each through `scoreToY` (`:117`, `:118`); `min`/`max` pick the cuts, `+ rowTop` places the row |
| `wiggle.slang` scatter | a per-instance scalar through a shared scale, as a glyph centre in a row | `scoreToY(...) + rowTop` (`:90`), then `pointGlyph` |
| `wiggleLine.slang` line / linecenter | two or three scalars at once through the same scale — a neighbour's y is this instance's geometry | `rowScoreToClipY` (`:66`), `scoreToY` ×2 (`:137`, `:139`) |
| `coverageBand.slang`'s five passes | a per-instance scalar through the same shared scale, as a fraction of a bar measured **up from a band baseline** | `covNormalizeDepth` → `normalizeDepthScalar` → `normalizeScore` (`:205`), then `covBarHeightPx` (`:229`) and `covSegQuad`'s `(yOffset, segHeight)` stack |
| `manhattan.slang` | a per-instance scalar through its **own linear-only** scale, as a glyph centre on the whole canvas | `scoreToYPx` (`:56`) — `clamp((s − min) / max(range, 1e-6))`, then `(1 − norm) · h` |
| `alignmentsUniforms.slang`'s arc band | a per-instance **bp** scalar through its own log-or-linear scale, as an offset from a band anchor | `arcYFraction` (`:513`) → `arcYOffsetPx` (`:524`) = `min(availH, f · availH)` |

Four families fall outside the cardinality, and saying which is half the census's
value — none of them is a y-scale spelling that has drifted, so none of them is a
consumer any factoring could pull:

| Shader | Why it is not this channel |
| --- | --- |
| `wiggleDensity.slang` | the scalar is real and goes through the same scale, but it feeds **colour**; y is a row index through `rowRectClipPos` |
| `hic.slang`, `ldGenomic.slang` / `ldUniform.slang` | y is positional — a 45° rotation of two coordinates through `diagonalCellToClip`, with no scalar in it |
| `dotplot.slang` | y is a second genomic axis (`u.bpPerPxVInv`, `u.panPxV`), an hpmath projection like x |
| `rowRect`'s consumers — `multiRow`, `maf`, `variant`, `variantMatrix` | y is a row index and a band height, never a value |

Every row of the first table varies the same two things — which scale carries the
scalar to `[0,1]`, and what the resulting fraction is anchored against — while
the mark's geometry is a separate question each already answers through the shape
library. That is the same split ADR-094 found on colour, where the ramp half
factored and the three scales did not.

The CPU sides mirror the shader sides one for one, and each pairs a normalizer
with an anchor of its own:

| CPU site | The scale | The anchor |
| --- | --- | --- |
| `wiggle-core/computeYTicks.ts` | d3 through `getScale` | `axisPlotBox`'s `[yBottom, yTop]` range |
| `wiggle-core/yScaleTicks.ts` | the caller's, already applied | `scoreToAxisY` = `yTop + (1 − n) · plotHeight` |
| `wiggle-core/scoreRuleMarks.ts` | a `normalize` **parameter**, the display's own | a `box` parameter, the display's own |
| `alignments-core/coverageDownsampling.ts` | `makeScoreNormalizer` | `yBottom − n · effectiveH` |
| `alignments/insertSizeTicks.ts` | `arcYFraction`, generated from the shader | `arcAnchorY` / `arcMarkY`, with a direction flip |

`scoreRuleMarks` is the interesting row: it takes both halves as parameters and
its JSDoc says why for each — the normalizer because "the axis need not be
linear", the box because "the alignments coverage band does" lay its axis out
differently. A function that already refuses to assume either half is the tree
stating this ADR's rule before anyone wrote it down.

## Decision

**A per-instance scalar's vertical position is a shared scale and a per-consumer
anchor.** The scale half is `scoreScale.slang` and the anchor half stays with the
display, and neither of those is a shape question.

The scale half already factored, and the census is what says it is done rather
than in progress. `scoreScale.slang` carries three importers — `coverageBand`,
`wiggleCommon` and `wiggleDensity` — over ADR-040's bar of two, and its
`//! js-export`ed `normalizeScore` is the oracle both cross-backend sweeps run
against (`normalizeScoreParity.test.ts` in wiggle, `coverageNormalizeParity.test.ts`
in alignments). `coverageBand.slang`'s `normalizeDepthScalar` reads like the
surviving twin and is not one: its body is a one-line delegation to
`normalizeScore`, and it exists so the JS emitter has a symbol to emit into
`@jbrowse/alignments-core`, which sits upstream of render-core and cannot import
the other generated copy. The two generated bodies are byte-identical because one
`.slang` source generates both, which is what ADR-051's codegen is for.

The anchor half does not factor, and this is measurement rather than caution.
Each consumer anchors a fraction against something structurally different — a
row within a stack of rows, a baseline inside a band that reserves a label inset
at both ends, the whole canvas, a band edge whose direction flips with the arc
orientation — and where two of those anchors agree numerically over the ordinary
range, they disagree in exactly the corner one of them exists to handle.

## The measured refusals

Four unifications the census put on the table. All four were measured and all
four trip a kill condition; the numbers, the reopen conditions and the
one-paragraph verdicts are in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md).

- **Manhattan onto `scoreScale`** trips two independently. Its degenerate-domain
  answer is pinned as a cross-backend fix, not an accident: `scoreToYPx(0.5, 0, 0, 100)`
  is 0 — a score above a pinned domain sits off the top — where `normalizeScore`
  answers 0 and so places it at 100, the bottom. That is the full canvas height,
  on a value `scoreToYParity.test.ts` names and explains. Separately, Manhattan
  pins `scaleType: 'linear'` in its domain builder, its `ticks` getter and its
  track menu, so composing would add `scaleType` and `symlogConstant` uniforms
  with exactly one value each — ADR-040's single-caller parameter.
- **The coverage band's tick anchor onto wiggle's `scoreToAxisY`** agrees
  everywhere the band is taller than its two 5px label insets and diverges
  below: at `covHeight = 8` the coverage anchor answers 3 for every normalized
  value while the wiggle anchor answers 5. That is the case
  `covEffectiveHeightPx`'s floor-at-0 was added for, so unifying changes drawn
  output in the one window the two spellings were written apart to handle.
- **The arc band's `arcYFraction` with hic's `mapHicCount`** share a log branch
  exactly — `log2(max(v, 1)) / log2(max(dmax, 2))` in both — and part company on
  the linear one and on where the clamp sits. Factoring the shared line leaves
  both wrapper functions, both `//! js-export`s and both parity suites standing,
  so it deletes one line and no twin. It also crosses channels: one result is a
  y offset and the other a ramp position, which makes it evidence that a
  normalizer is channel-agnostic rather than a y-channel factoring.
- **Deleting `normalizeDepthScalar`** deletes the alignments coverage sweep. Its
  only non-generated caller is `coverageNormalizeParity.test.ts`, which is the
  point of it — an ADR-051 oracle, the same standing `normalizeScore`'s own JS
  twin has, whose only importers are two parity tests.

## Consequences

- The next display that plots a scalar on y is, by default, a consumer of
  `scoreScale` with an anchor of its own. Writing a fourth normalizer now needs
  an argument, and Manhattan and the arc band are the two that have one on
  record rather than precedents to copy.
- The y axis owes no composition. ADR-095 left the impression that density was
  the first of several compositions; this census says it was the only one
  available, because the remaining consumers of the scale half already import it
  and the anchor half has no shared consumer to serve.
- `scoreRuleMarks`' parameter shape is the pattern for a CPU-side reader of this
  channel: take the normalizer and the box, assume neither.
- ADR-040 and ADR-051 are untouched, and both did real work here — ADR-040's
  single-caller clause is what refused the Manhattan uniforms, and ADR-051's
  "drawn and exported are one boundary" is what makes the degenerate-domain value
  a pinned one rather than an implementation detail.
- [reference/SHADER_SHAPE_LIBRARY.md](../reference/SHADER_SHAPE_LIBRARY.md)
  §"What is deliberately NOT shared" carries the anchor row; the atoms list is
  unchanged, because no module joined.
