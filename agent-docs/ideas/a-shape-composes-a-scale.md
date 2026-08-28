---
name: a-shape-composes-a-scale
description: render-core already holds a shape module (rowRect.slang) and a scale module (scoreScale.slang) and has never composed them, while four displays each spell "colour is a per-instance scalar through a ramp" their own way — wiggle density inline, HiC and LD through a Sampler2D at the same binding slot, arc through a palette index. The plan composes the two on wiggle density first, because density's autoscale domain is a uniform and resolving its colour CPU-side would turn a pan into a buffer re-upload. Independent of ADR-089/090/091: a shape library holds no colorBy, no RPC and no layout, so ADR-091's reopening condition does not govern it. Gates, kill conditions, and what it must not become.
---

# A shape composes a scale

`packages/render-core/src/shaders/` holds a shape module and a scale module.
Nothing composes them.

- `rowRect.slang` (141 lines) is a shape: one instance is a rect spanning
  `[startBp, endBp)` on row `rowIndex`, filled with a per-instance packed ABGR
  colour. `maf.slang` (33 lines) and `multiRow.slang` (27 lines) are its two
  consumers, and its header records what it replaced — two byte-identical
  copies "joined only by a 'probably belongs there too' comment".
- `scoreScale.slang` is a scale: `normalizeScore(score, domainMin, domainMax,
  scaleType, symlogConstant)` plus the `SCALE_TYPE_LOG` / `SCALE_TYPE_SYMLOG`
  vocabulary its branches switch on. Its consumers reach it through
  `wiggleCommon.slang` and `coverageBand.slang`, and its header records the same
  history: two branch-for-branch copies that had already diverged on a
  degenerate domain.

Shape and scale are the two halves of a grammar's encoding — genome-spy spells
them `mark` and `scales`, and a channel binds a field to one of each. Both
halves are in this tree, in one directory, unjoined.

## Four displays spell the missing half four ways

Colour cardinality across the live shaders:

| Shader | Colour is | Spelled |
| --- | --- | --- |
| `rowRect.slang` | a per-instance resolved value | `uint color : ATTR3`, packed ABGR |
| `arc.slang` | a per-instance index into a uniform palette | `float colorType : ATTR2` → `arcColorByIndex()` (`:366`) |
| `wiggle.slang` density | a per-instance scalar through an inline ramp | `float score : ATTR1` → `lerp(white, instColor.rgb, densityGradientT(norm, zeroNorm))` (`:156`) |
| `hic.slang` | a per-instance scalar through a texture ramp | `float count : ATTR1` + `Sampler2D<float4> colorRamp` at `binding(2, 0)` |
| `ldGenomic.slang` / `ldUniform.slang` | a per-instance scalar through a texture ramp | `float ldValue : ATTR2` + `Sampler2D<float4> colorRamp` at `binding(2, 0)`, via `ldUniforms.slang:57` |

The last three are one concept written three times. HiC and LD reached the same
answer independently, down to the binding slot; density reached a weaker version
of it, and the weakness is visible to a reader: HiC offers viridis and fall
(`colorRamp.ts:97`, `generateColorRamp` → a 256-entry `Uint8Array`), and density
offers `lerp` from white, because its ramp is arithmetic in the shader rather
than a sampled table.

**That is the finding: a scaled colour channel is not a thing this tree lacks.
It is a thing this tree has four of.**

[ADR-090](../architecture-decision-records/adr-090-a-mark-is-a-shape-plus-its-channels.md)
ruled that a per-instance colour lane is "a second shape variant rather than an
option on this one" and was rejected with the factory
([ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)),
so the ruling binds nothing today. The table above is why it should not come
back: it describes `bar`, whose colour was a per-frame uniform, and `bar` was
the least expressive of the five.

## Why wiggle density is the consumer that forces the composition

Density's geometry is already `rowRect`. `wiggle.slang:135`:

```
if (u.renderingType == RENDERING_TYPE_DENSITY) {
  topPx = rowTop;
  botPx = rowTop + rowHeight;
}
```

A rect filling its row, from `startEnd` to `startEnd`, at `rowIndex` — which is
`RowRectInstance` with a `score` added. `multirowdensity` is the same shader
path (`renderingTypes.ts`); `rowIndex` and `numRows` are what make single-row
and multi-row one code path, so multiwiggle comes along at no extra cost.

**What stops density from simply becoming `rowRect` today is autoscale, and the
reason is architectural rather than cosmetic.** `domainYMin` and `domainYMax`
are uniforms — `GpuWiggleRenderer.ts:137` writes `state.domainY[0]` into the
uniform block — and autoscale resolves against the visible data, so the domain
moves on every pan (`wiggle-core/src/scoreRuleMarks.ts:30`). Because the score
stays in the instance buffer and the domain stays in a uniform, a pan costs one
uniform write. Resolve the colour on the CPU into a packed ABGR lane and the
same pan re-packs and re-uploads the whole buffer.

So the fourth cardinality is load-bearing. A shape library that cannot express
"a per-instance scalar through a uniform scale" has to choose between a new
shader per ramp and a re-upload per pan, and the tree has already chosen the
first four times.

## The plan

### Step 1 — Write the cardinality rule down

One ADR: **constant, per-instance value, per-instance palette index, and
per-instance scalar through a scale are cardinalities of one colour channel, not
four shapes.** The document describes what five shaders already do; it proposes
nothing.

Costs a document. No gate — a description of the tree cannot fail.

What it buys: the next shader that needs a ramp stops being a new shader, and
ADR-090's ruling does not return by default when someone reads it and does not
notice its status.

### Step 2 — Compose `rowRect` × `scoreScale` on wiggle density

Lift density out of `wiggle.slang`'s `renderingType` branch onto a composed
shape: `rowRect` geometry, `scoreScale` normalization, a ramp.

**Gate A, and it is the one that matters: autoscale must stay a uniform write.**
Instrument the pan path before and after. If the composition forces a CPU-side
colour resolve, stop and record it — the cardinality does not factor, and that
is a result worth having.

**Gate B: `wiggle.slang` must get simpler when density leaves.** The file
branches xyplot / density / scatter on one uniform and shares the clip-space
conversion between them. If removing one arm does not shrink the other two,
the branch was earning its place and the shape boundary is drawn wrong.

**Kill condition:** a parameter on the composed shape with exactly one caller.
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
declined a shared quad on a two-consumer bar for that reason and the reason
still holds.

### Step 3 — Decide whether the ramp is a texture, and prove it on a second consumer

HiC and LD both bind `Sampler2D<float4> colorRamp` at `binding(2, 0)`; density
computes its ramp inline. A composed shape has to pick one, and the texture form
is the one that already serves two displays and already carries viridis.

**Gauge: density gains an arbitrary ramp without a new shader.** Today a
density track can only fade from white to its track colour. If Step 2 lands on
the texture form, viridis on a density track is a uniform and a LUT upload.

**Gate C: the second consumer must reuse the LUT upload path, not merely import
the shader module.** Two shaders that sample the same way through two upload
paths is the divergence `scoreScale`'s header already documents, one layer up.

**Open, and cheap to settle before committing to Step 3:** do HiC's and LD's
ramps actually factor the same way? Both normalize a per-instance scalar and
sample a 256-entry table, but HiC's `hic.slang:60` splits its count → ramp point
out specifically so the Canvas2D twin lands on the same entry, and LD's lives in
`ldUniforms.slang`. Read both against `scoreScale` before assuming three
consumers rather than one.

### Step 4 — `point` as the second shape

`pointGlyph.slang` is in render-core with one consumer (Manhattan's disc), and
the dotplot draws points too. Ordered after the ramp work because a second shape
is worth less than a second cardinality: cardinality is the axis that multiplies
the shape list if it is got wrong.

**Gate D: the dotplot's shader must actually shrink.** If it does not, the
library has one shape, which is a fine answer — ADR-090's surviving clause is
that a shape joins on a consumer's pull, not on completeness.

## What this is not

**Not the factory.**
[ADR-089](../architecture-decision-records/adr-089-a-track-type-is-a-spec-the-factory-composes-the-stack.md),
ADR-090 and ADR-091 are about an authoring surface: a display handed to
`defineDisplay` as a spec. Nothing here registers a display, composes an MST
chain, holds a config slot or crosses an RPC boundary. ADR-091's reopening
condition — hold alignments' `colorBy`, or Manhattan's LD model and dual-rename
RPC, without an `extend`, and stay lazy — governs a replacement for the display
stack. A shape library holds none of those things.

The eager-closure finding does not reach it either, and the existing consumers
are the proof. ADR-091's closure is about what a *registration* names by value:
the factory named the `bar` shader, so plugin install loaded it. A shape reached
through a display's own `lazy()` component is not eager, which is how `rowRect`
reaches both its consumers today — `maf/LinearMafDisplay/index.ts:10` and
`canvas/LinearMultiRowFeatureDisplay/index.ts:10` are both `lazy(`. A composed
shape inherits that, because the display, not a factory, owns the registration.

ADR-090 was reverted because the factory it rode on was, and the port that
decided ADR-091 drew with Manhattan's own hand-written shader — the mark
system's only role in that experiment was as eager bytes in ADR-091's closure
table. The mark thesis was never tested. This plan tests the half of it that has
consumers.

**Not a transpiled draw stage.**
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
stands. A composed shape is hand-written Slang that imports two hand-written
modules, which is what `maf.slang` and `multiRow.slang` already are.

**Not a layout abstraction.** The boundary the grammar comparison settles on is
that placement, tiering and the fetch stay imperative and per-display. Both
vendored grammars have a declarative pileup (genome-spy's `transforms/pileup.js`
is 126 lines; gosling's `displace: pile`), and this tree's is `sortLayout.ts`
plus `layout.ts` because it is stateful across frames (`seedRowsFrom`,
`groupUnchanged`) and re-entrant against a height solve (`createPackProbe`).
Nothing in this plan touches either file. See
[reference/SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)
§"The assessment".

**Not hit-test derivation.**
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) owns
that question, and its `features/mark.ts` reads pileup row geometry, which puts
it below the layout boundary this plan stays above. The two converge only if a
mark takes its row band as an argument rather than reaching into layout — an
open question there, not a dependency here.

## What each step lets the manuscript claim

| Step | The claim it earns |
| --- | --- |
| 1 | encodings are orthogonal to shapes — stated over five shaders, not one |
| 2 | a shape and a scale compose, and the composition keeps a pan at one uniform write |
| 3 | one ramp mechanism across quantitative, contact-matrix and LD colouring |
| 4 | a shape library with two shapes and a stated admission rule |

Step 2's row is the one that distinguishes a shape library from a bag of
shaders. Do not write the grammar claim against Step 1 alone: a rule describing
five shaders is a census, not a mechanism.

## Ground this changes

- **ADR-090's colour ruling**, which is already inert (rejected with ADR-091) but
  reads as live to anyone who opens the file. Step 1's ADR should name it and say
  what replaces it.
- **ADR-040** is *not* overturned. It declined a shared quad helper on a
  two-consumer bar and said a third-party ergonomics argument would be "a
  different justification". This plan makes neither argument: it consolidates a
  cardinality that five shaders already implement, and Gate A is a measurement
  ADR-040 never had available.
- **`reference/SESSION_SPEC_FORMAT.md`** decided the grammar question for the
  *spec a reader writes* and for the authoring surface, both negative. This plan
  is the third place the question lands — below the display, where the answer
  differs — and that doc should point here so the three are not read as one.
