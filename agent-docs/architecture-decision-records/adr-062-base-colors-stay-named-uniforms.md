---
status: Rejected
summary: "colorBaseA/C/G/T/N stay five named uniforms read under two index spaces rather than becoming one slot-indexed float4[N] palette: the naive conversion adds a second representation of a runtime-mutated color, and the full version moves the mismatch instance base field's meaning through the worker payload to delete two switches that are correct and tested"
---

# ADR-062: Per-base colors stay named uniforms, not a slot-indexed palette

## Status

Rejected (2026-08). Bounds the "indexed palettes beat branch chains" rule in
[reference/SLANG_UNIFORM_ARRAYS.md](../reference/SLANG_UNIFORM_ARRAYS.md), which
is otherwise correct and was applied twice on purpose. This ADR is the decision
of record for the one candidate that keeps looking like the next application and
is not.

## Context

Two shader colour selections were converted to uniform-block arrays and both
were wins:

- `read.slang`'s 17-arm `cat == RC_X` chain became `u.readCategoryColor[cat]`,
  which deleted a test that re-read the shader source with a regex.
- `arcMarkerColorByIndex` became a second `float4[ARC_COLOR_SLOTS]` written from
  the palette the Canvas2D and SVG draws already read, deleting a branch that
  indexed an array in one arm and unpacked a uint in the other.

The rule those produced — *if the CPU can name the substitution, upload the
substituted table* — points straight at `colorBaseA/C/G/T/N` next. It was listed
as the next candidate, held back in early August only because the coverage strip
was then under suspicion for the unattributed alignments WebGPU drift. That hold
expired (the drift is baselined and confirmed pre-existing) and the conversion
was attempted. It should not be finished, for two reasons the original framing
missed.

### The five colors are not snpCoverage's, and are read under two index spaces

They live in the shared `alignmentsUniforms` block and two shaders read them
differently:

- `coverageSnp.slang` switches on `colorType` 1–5.
- `mismatch.slang` switches on the **ASCII base code** — `case 65u: case 97u:`
  for A, and so on, with `default:` covering N and everything else.

Giving snpCoverage a `float4[5]` palette leaves mismatch on the named uniforms,
so the same five colors end up with two representations inside one uniform
block. That is the mirror the conversion exists to delete, reintroduced one
level down.

### One of the five is mutated at runtime

`GpuAlignmentsRenderer.writeUniforms` overwrites all five with
`colorMutedSnpBase` when `showModifications` is on, so modification overlays
stand out. A second representation would need the same swap applied to it, in
step, forever.

The Canvas2D side is downstream of that swap and knows it. This has already
produced one real bug: call sites read the raw `colors.colorBaseN` for their
non-ACGTN fallback while the GPU reached the same case through mismatch's
`default: colorBaseN` — *already greyed* — so a stray IUPAC base painted blue on
Canvas2D and grey on GPU. (BAM's 4-bit alphabet is `=ACMGRSVTWYHKDBN` and the
extractors only upper-case the byte, so ambiguity codes reach the draw in
ordinary data.)

The fix was not a shared palette. It was funnelling every Canvas2D reader
through three functions in `features/mismatch/baseColors.ts` —
`buildBaseColorTupleMap`, `baseColorFallback`, `buildBaseCssMap` — so the mute
condition is written once. **That is the important change in the cost estimate:**
the "mirror maintained in step forever" the palette refactor was meant to delete
has since collapsed to one file with three exported builders, covered by
`baseColors.test.ts`, `coverageParity.test.ts` and `cellPainterParity.test.ts`.
The payoff shrank; the cost did not.

### The version that would actually help is not a cleanup

One palette indexed by a base *slot*, with the CPU mapping both `colorType` and
the ASCII code to that slot before packing. That moves the meaning of the
mismatch instance `base` field, and so touches the worker payload, the hot pack
loop, the grey swap, the legend, and the Canvas2D builders. It is a real
option — but the two switches it deletes are currently correct and covered, so
the drift risk removed is small against the regression risk added.

## Decision

**Keep `colorBaseA/C/G/T/N` as five named uniforms in `alignmentsUniforms`, read
by `coverageSnp.slang` under `colorType` and by `mismatch.slang` under the ASCII
base code.** Do not give either shader a `float4[5]` of them, and do not
undertake the slot-indexed rework.

Per-base color parity between GPU and Canvas2D is maintained by the
`features/mismatch/baseColors.ts` builders plus the parity tests, not by a
shared uploaded table.

## Consequences

- The `SLANG_UNIFORM_ARRAYS.md` rule keeps applying to *new* palettes; this is a
  bounded exception, and the boundary is the runtime mutation. A palette the CPU
  can name once per block render is the shape that rule is about. A palette
  something overwrites conditionally at write time is not.
- Anything drawing per-base colors on Canvas2D must call one of the three
  builders rather than inlining the palette selection or re-spelling the
  non-ACGTN fallback — that omission is exactly how the IUPAC bug happened, in
  three call sites at once. `baseColors.ts` says so at the top; this is the why.
- The two switches stay. A reviewer who sees `case 65u: case 97u:` in
  `mismatch.slang` next to `u.readCategoryColor[cat]` in `read.slang` and reads
  it as an unfinished migration should read this ADR: they are different
  problems that happen to look alike.
- Revisit only if the `base` field's meaning has to change for an unrelated
  reason — the worker payload rework is the expensive half, so a change that
  already pays for it flips the arithmetic. Not otherwise.

## Related

- [reference/SLANG_UNIFORM_ARRAYS.md](../reference/SLANG_UNIFORM_ARRAYS.md) —
  the rule this bounds, and the `float4[N]`-not-scalar-array requirement behind
  any palette upload.
- [ADR-051](adr-051-shader-js-codegen-is-scalar-only.md) — the other GPU↔Canvas2D
  parity mechanism, for scalar decision functions.
- [reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) —
  where the alignments WebGPU drift that once gated this was baselined.
