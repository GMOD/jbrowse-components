---
status: Accepted
summary: "Encoding-level composition is adopted: a display's shader composes a shared shape, a per-consumer scale and one ramp mechanism as hand-written Slang imports inlined by slangc at gen:shaders — zero runtime module edges, so ADR-091's eager-bundle constraint cannot reach it. Records the measured gates the wiggle tests cite (a pan that moves the autoscale domain uploads 0 buffer bytes), the point-shape stop, the capsule, and the grammar-of-graphics position as one ladder: refused at the authoring level, refused on measurement at the display level, adopted at compile time below it"
---

# ADR-095: A shape composes a scale at compile time

## Status

Accepted (2026-08-29). This ADR records the composition work that acted on
[ADR-094](adr-094-colour-cardinality-is-one-channel-not-four-shapes.md)'s rule —
the plan ran as `ideas/a-shape-composes-a-scale.md` during 2026-08-28/29 and is
closed; this file is its record. The library itself is documented in
[reference/SHADER_SHAPE_LIBRARY.md](../reference/SHADER_SHAPE_LIBRARY.md), which
stays the operational doc (what each shape draws, who imports it, how to add
one). This ADR holds the decision, the measured gates, and the grammar position.

## Context

`packages/render-core/src/shaders/` held a shape module (`rowRect.slang`, two
consumers) and a scale module (`scoreScale.slang`, real consumers through
`wiggleCommon.slang` and `coverageBand.slang`), and nothing composed them.
ADR-094's census found five shaders spelling a scaled colour channel five ways —
the cardinality was one channel, but the tree had chosen "a new shader per ramp"
four times.

Shape and scale are the two halves of a grammar's encoding, and GenomeSpy
factors at exactly this seam: each mark's hand-written vertex GLSL calls
`getScaled_<channel>()` functions generated per encoding over a shared
scale-primitive library, with domains wired to uniforms so pan and zoom never
touch a vertex buffer. That is independent confirmation the factoring is the
standard one. The difference kept here is
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md)'s: the composition is a
hand-written Slang import, never generated code.

The consumer that forced the composition was wiggle density, and the reason is
architectural: density's autoscale domain moves on every pan and lives in a
uniform, so a shape library that cannot express "a per-instance scalar through a
uniform scale" has to choose between a new shader per ramp and a buffer
re-upload per pan.

## Decision

**A display's shader composes a shared shape, a per-consumer scale and one ramp
mechanism, and the composition happens at compile time.** `slangc` inlines
`import rowRect` at `pnpm gen:shaders`, so the generated shader carries no
runtime import of render-core's modules — zero runtime module edges, zero
registration bytes. That structural fact is what makes this independent of
[ADR-091](adr-091-a-displays-settings-are-a-declaration.md): ADR-091's closure
was about what a *registration* names by value, and a composed shape registers
nothing, so the eager-bundle constraint cannot reach it even for a consumer that
registers eagerly.

The three parts:

- **The shape is shared.** `wiggleDensity.slang` composes `rowRect`'s factored
  geometry (`rowRectClipPos`) over the existing fill buffer — no new packer, no
  new buffer. The library's admission bar stays ADR-090's surviving clause via
  [ADR-040](adr-040-no-genome-quad-vertex-helper.md): a shape joins on a
  consumer's pull, with two real consumers and non-obvious math.
- **The scale stays per-consumer.** The three normalizers do not unify and must
  not: HiC's `mapHicCount` is `js-export`ed so three backends land on one LUT
  entry, and moving it onto `scoreScale` changes pinned cross-backend values;
  LD's "normalization" is an affine signed remap plus the `LD_NOT_COMPUTED`
  sentinel — semantics, not scaling; `scoreScale` keeps the consumers it has.
- **The ramp is one mechanism.** `colorRampLut.slang` (`rampColor`,
  `rampColorPremultiplied` — two named entries, not a flag) plus one upload path,
  `uploadColorRampLut` (`render-core/src/colorRampLut.ts`). HiC, LD and wiggle
  density all go through both halves; no `hal.uploadTexture` call is left under
  `plugins/`.

## The measured record

The gates below are cited by name from the wiggle test suites
(`gpuWiggleRenderer.test.ts`, `densityColorParity.test.ts`); this section is
their definition.

- **Gate A — autoscale stays a uniform write, instrumented as bytes uploaded
  per pan.** A density region uploads 40 bytes (2 × 20-byte record); a pan
  whose autoscale moves `domainY` uploads **0 buffer bytes** and costs one
  64-byte uniform write per drawn block. Neither failure mode exists
  structurally: `packFillInstances` takes no domain, and `installUpload`'s
  `inputs` carries no domain — the domain rides `renderState`, read per frame
  by the render autorun.
- **Gate B — the source shader shrank when density left.** `wiggle.slang`
  217 → 183 lines; the surviving xyplot/scatter arms lost their density
  branches rather than keeping dead structure.
- **Gate C — both backends and the export land on the same ramp entry.**
  `densityColorParity.test.ts` sweeps 8 domain/scale/origin cases × 3 track
  colours × 10 scores: the GPU chain lands within one LUT bucket of the
  Canvas2D factory, the pivot is white exactly on both backends, and the far
  domain end is the track colour exactly on the GPU side. This is the gate the
  tree's history demands — the GPU/Canvas2D/SVG seam is where composition has
  actually broken here (ADR-051's "drawn and exported are one boundary").
- **The named-ramp gauge — a named ramp without a new shader.** Viridis on a
  density track is the `densityColorRamp` config slot: one uniform flag plus
  one 1024-byte LUT upload through the shared path, zero new shaders. The
  per-row default (`lerp(white, inst.color.rgb, t)`, which one LUT cannot
  encode — multiwiggle colours per row) stays the default beside it, so the LUT
  is an alternative a config names, not a replacement. All three renderers and
  the legends read one cached table (`densityRampLut`, `stopsFromRampLut`,
  `VIRIDIS_STOPS` in `@jbrowse/core/util/colorRamp`).
- **Gate D — the second ramp consumer reuses the LUT upload path, not merely
  the shader module.** All three consumers moved in one change; the helper's
  three parameters are each exercised by every caller. Kill condition (a
  parameter with exactly one caller) stayed clear throughout.
- **The point-shape step stopped at the census, correctly.** `pointGlyph`
  already had the two consumers the step set out to earn it (Manhattan and
  wiggle scatter), and the dotplot draws capsules, not point glyphs — every
  transferable line would have changed drawn output, which a factoring step
  forbids. Zero lines moved; the stop is the result.
- **The capsule is the fourth shape, and its landing changed drawn output on
  purpose.** `capsule.slang` states one SDF where two copies in two frames had
  drifted on their degenerate guards — and the extraction exposed that
  `arcFlat` and `linkedReadLine` inked round caps under comments calling them
  butt-capped, ink neither Canvas2D nor SVG drew. They now measure
  `buttSegmentCoverage`; `buttSegmentCoverage.test.ts` pins the cut and the
  wiring. The cap split (one named coverage per cap style, no `capStyle` flag)
  is documented in SHADER_SHAPE_LIBRARY.md.

## The grammar position, as one ladder

The grammar-of-graphics question — the comparison with GenomeSpy and Gosling —
got three answers at three levels, on different evidence, and they must not be
read as one:

1. **Authoring level: refused.** JBrowse is format-typed where the grammars are
   mark-typed — a track is a file format, and the reader never picks a mark, so
   "any channel on any mark" has nothing to attach to.
   [reference/SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)
   §"The assessment" is the argument, with GenomeSpy's own 532-line BAM example
   as the cost of the alternative.
2. **Display/settings level: refused, on measurement.** ADR-091's declaration
   table across four display models eliminated zero getters — the cost sits in
   layout, tiering, fetch shape and per-display meaning, not in channels.
3. **Encoding level: adopted, at compile time.** This ADR. The factoring is
   the same one GenomeSpy uses; the form is hand-written imports inlined by
   `slangc` rather than runtime codegen.

Two divergences from the grammars are positions, not shortfalls: the scales
stay per-consumer (pinned cross-backend values beat a scale taxonomy), and
layout stays imperative and stateful (`sortLayout.ts`'s cross-frame seeding and
pack-probe re-entrancy have no declarative `pileup` transform equivalent).
And one claim must not be oversold: Gate A's pan cost is *parity* with
GenomeSpy, whose scale uniforms achieve the same property — the differentiators
are the compile-time form and the measured refusals above, not the pan.

What each landing lets the manuscript claim:

| Landing | The claim it earns |
| --- | --- |
| ADR-094 | encodings are orthogonal to shapes — stated over five shaders, not one |
| the density composition | a shape and a scale compose, and the composition keeps a pan at one uniform write |
| the ramp module | one ramp mechanism across quantitative, contact-matrix and LD colouring, each keeping its own scale |
| the point stop + the capsule | a shape library with four shapes and a stated admission rule that has declined an entry |

The density-composition row is the one that distinguishes a shape library from
a bag of shaders; the grammar claim is not written against ADR-094 alone,
because a rule describing five shaders is a census, not a mechanism.

## Consequences

- The next shader that needs a ramp is a consumer of `colorRampLut` plus its
  own scale, by default — a fourth spelling now needs an argument (ADR-094).
- ADR-040 and ADR-051 stand untouched: nothing here is a generated draw stage
  or a single-consumer helper, and every module landed on two-plus consumers.
- ADR-089/090/091 are not reopened. The composition registers nothing,
  composes no MST chain, holds no config slot beyond `densityColorRamp` (an
  ordinary display slot) and crosses no RPC boundary; ADR-091's reopening
  condition governs a replacement for the display stack, which a shape library
  is not.
- The layout boundary holds: placement, tiering and the fetch stay imperative
  and per-display. Nothing in this work touched `sortLayout.ts` or `layout.ts`.
- [reference/SHADER_SHAPE_LIBRARY.md](../reference/SHADER_SHAPE_LIBRARY.md) is
  the living doc — the consumer table there is generated, and a shape or
  consumer added later changes that page, not this record.
