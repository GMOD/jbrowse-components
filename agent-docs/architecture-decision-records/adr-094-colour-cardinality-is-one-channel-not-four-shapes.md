---
status: Accepted
summary: "Constant, per-instance value, per-instance palette index, and per-instance scalar through a scale are cardinalities of one colour channel, not four shapes — stated over the five live shaders that already implement them. Replaces ADR-090's inert per-instance-colour ruling on the colour axis; ADR-090's admission clause, ADR-040 and ADR-051 all stand. Describes what the tree does and proposes nothing"
---

# ADR-094: Colour cardinality is one channel, not four shapes

## Status

Accepted (2026-08-28). This ADR describes what five live shaders already do; it
proposes nothing and carries no gate — a description of the tree cannot fail.
[ideas/a-shape-composes-a-scale](../ideas/a-shape-composes-a-scale.md) is the
plan that acts on the rule, and that plan's gates are its own; nothing beyond
the description is committed here.

On the colour axis this ADR replaces
[ADR-090](adr-090-a-mark-is-a-shape-plus-its-channels.md)'s ruling that "a
per-instance color channel … is a second shape variant rather than an option on
this one".
[ADR-091](adr-091-a-displays-settings-are-a-declaration.md) rejected ADR-090
with the factory, so the ruling binds nothing today — but ADR-090's file reads
as live to anyone who opens it, and writing the replacement down is what stops
the ruling returning by default. ADR-090's surviving clause — a shape joins on
a consumer's pull, not on completeness — still governs admission.
[ADR-040](adr-040-no-genome-quad-vertex-helper.md) (no single-consumer
composition helper, no generic vertex skeleton) and
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md) (codegen covers scalar
decisions, never a draw stage) both stand: nothing here is a generated draw
stage or a shared vertex framework, and a composed shape remains hand-written
Slang importing hand-written modules, which is what `maf.slang` and
`multiRow.slang` already are.

## Context

ADR-090's `bar` mark took its colour as one uniform per frame, and the ADR
ruled that letting colour vary per instance "changes the instance layout, so it
is a second shape variant rather than an option on this one". Under that
ruling, each way colour varies is a new shape.

The live shaders answer differently, and the census (re-measured 2026-08-28,
every citation verified against the current file) is the evidence:

| Shader | Colour is | Spelled |
| --- | --- | --- |
| `rowRect.slang` | a per-instance resolved value | `uint color : ATTR3`, packed ABGR |
| `arc.slang` | a per-instance index into a uniform palette | `float colorType : ATTR2` → `arcColorByIndex()` (`:366`) |
| `wiggle.slang` density | a per-instance scalar through an inline ramp | `float score : ATTR1` → `lerp(white, instColor.rgb, densityGradientT(norm, zeroNorm))` (`:159`, where `norm` is already `scoreScale`'s `normalizeScore`, `:157`) |
| `hic.slang` | a per-instance scalar through a texture ramp | `float count : ATTR1` + `Sampler2D<float4> colorRamp` at `binding(2, 0)` |
| `ldGenomic.slang` / `ldUniform.slang` | a per-instance scalar through a texture ramp | `float ldValue` (`ATTR2` / `ATTR0`) + `Sampler2D<float4> colorRamp` at `binding(2, 0)`, via `ldUniforms.slang:57` |

Every row varies one thing — where the fragment's colour comes from — while
the geometry question is untouched. `bar`, the shape ADR-090 ruled from, was
the least expressive of the set, and its per-frame uniform is the degenerate
first cardinality.

## Decision

**Constant, per-instance value, per-instance palette index, and per-instance
scalar through a scale are cardinalities of one colour channel, not four
shapes.** A shader that needs a different one of these has changed how a
channel is fed, not what shape it draws.

The last cardinality — a scalar through a scale — splits into a scale half and
a ramp half, and the tree's five implementations say only the ramp half
factors:

- **The ramp half factors.** HiC and LD reached the same mechanism
  independently, down to the binding slot (`Sampler2D<float4> colorRamp` at
  `binding(2, 0)`) and the premultiplied output (`//! blend: premultiplied` on
  both), and LD's `ldRampColor` already takes the sampler as a parameter — half
  a shared module exists. Density is the weaker third: its ramp is arithmetic
  in the shader, which is why HiC offers viridis and fall
  (`colorRamp.ts:97`, `generateColorRamp` over 256-entry `Uint8Array` LUTs)
  while a density track can only fade from white to its track colour.
- **The scale half is three normalizers that do not unify.** Density already
  composes `scoreScale` — `wiggle.slang:157` calls `normalizeScore`, with
  `densityGradientT(norm, zeroNorm)` as the transfer function between scale and
  ramp. HiC's `mapHicCount` is not `normalizeScore` and cannot silently become
  it: different floors (`max(count, 1.0)` and `max(colorMaxScore, 2.0)` against
  the domain's-own-min rule), different degenerate-domain answers, and it is
  `js-export`ed precisely so Canvas2D and SVG land on the same LUT entry the
  GPU does — moving it onto `scoreScale` changes pinned cross-backend values.
  LD has no scale at all: values arrive in [-1, 1], and its "normalization" is
  an affine signed remap plus the `LD_NOT_COMPUTED` sentinel gate
  (`ldValueComputed`, -2 → transparent).

So the composition the cardinality admits is shape × scale × ramp, with the
scale staying per-consumer. The idea doc holds the plan that builds it; this
ADR holds only the rule the five shaders already obey.

## Consequences

- The next shader that needs a ramp is, by default, a consumer of an existing
  cardinality rather than a new shape — the tree has spelled "a per-instance
  scalar through a uniform mapping" three times, and a fourth spelling now
  needs an argument.
- ADR-090's colour ruling stops returning by default. The ruling was rejected
  with its ADR rather than on its own merits, so a reader who takes ADR-090's
  record-as-accepted text at face value would revive it unopposed; this ADR is
  the standing answer on the colour axis, and the admission clause is the part
  of ADR-090 that still governs.
- ADR-040 and ADR-051 are untouched. The rule here is about what a colour
  channel is, not about extracting helpers (ADR-040's subject) or generating
  code (ADR-051's); a composition acting on the rule is compile-time `slangc`
  inlining of hand-written modules, the form both of those ADRs already allow.
- No gate, no kill condition. The plan in
  [ideas/a-shape-composes-a-scale](../ideas/a-shape-composes-a-scale.md)
  carries both for the work that acts on the rule.
