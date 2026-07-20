# ADR-040: No shared genome-quad vertex helper; hpmath atoms are the right granularity

## Status

Accepted (2026-07). Continues [ADR-005](adr-005-shader-codegen-slang.md) (Slang
codegen) and RFC-001 §5b ("primitives, not a framework"). The higher-risk
generic version of the same idea is tracked separately in
`reference/genome-mark-shader-abstraction-handoff.md` (gated on a spike, not
started).

## Context

Nearly every GPU track draws the same geometry: N instanced quads positioned by
`[genomicStart, genomicEnd] x [pixelY, height]`, snapped to pixels, colored by a
packed `u32`. That commonality keeps inviting a shared vertex helper. Two shapes
were considered:

1. A generic vertex **skeleton** parameterized over a per-mark instance struct
   (the high-value/high-risk version, see the handoff doc).
2. A plain **composition helper** in the hpmath tradition, e.g. a
   `genomeQuad` module exposing `genomeSpanX(bpStart, bpEnd, bpRangeX, zero,
   canvasW, minWidthPx) -> float2` that composes the existing atoms
   (`snapToPixelX(hpToClipX(...))` twice, then `extendToMinWidthX`).

This ADR is about option 2, evaluated purely on the integrity of the core
codebase as it stands today (the third-party-plugin ergonomics argument is
explicitly out of scope and, if it ever matters, is a different justification).

### What is already shared, and at what granularity

The genuinely reusable, drift-prone **atoms** already live in
`packages/render-core/src/shaders/hpmath.slang` and take **primitives, not a
`Uniforms` struct**: `hpToClipX`, `snapToPixelX`, `extendToMinWidthX`,
`yPxToClipY`, `quadLocal`. `pointGlyph.slang` is the precedent for a shared
*shape* module in the same style (disc SDF math, two real consumers, a
documented "must match" drift hazard).

### Why the composition helper does not clear the bar

Counting actual consumers of the proposed composition:

- **`extendToMinWidthX`** (the one atom with a real cross-shader min-width
  invariant that could drift) is **already shared by four shaders across three
  plugins**: `rect`, `multiRow`, `maf`, `wiggle`. That win is banked.
- **`snapToPixelX(hpToClipX(...))`** appears in only `rect` and `mismatch`, and
  `mismatch` **diverges on purpose** (`max(sx1 + 2/canvasW, snapToPixelX(clip2))`,
  a different floor) and flips downstream, so it cannot consume the helper
  regardless.
- The full `genomeSpanX` composition therefore has exactly **one** consumer:
  `rect`.

The other three `extendToMinWidthX` users derive their clip-X differently
(linear scale, already-snapped, etc.) and call the atom directly, which is
correct. They could not use `genomeSpanX`.

## Decision

**Do not extract a `genomeQuad` / `genomeSpanX` vertex-composition helper.**
Keep the reusable atoms shared in `hpmath` and let each mark compose them inline
with its own variations (min-width value, whether to snap, direction, flip
stage). The varying part stays explicit per mark, which is exactly RFC-001 §5b's
stance.

### Why not, concretely

- A new `render-core` module and public function serving **one** call site is
  premature abstraction. It banks roughly zero dedup while adding an indirection
  and an import.
- It would move three lines of readable, well-commented composition out of
  `rect.slang` into a helper a reader must jump files to understand, against the
  "no one-line helpers / complexity-not-LOC" grain.
- The atom that *could* drift (`extendToMinWidthX`) is already the shared thing,
  so the anti-drift value the helper would nominally add is already captured a
  level down.

### How this differs from `pointGlyph` (the precedent that did earn it)

`pointGlyph` had **two** real consumers, **non-obvious math** (disc SDF, AA-pad
thresholds), and a **documented drift hazard** between former copies.
`genomeSpanX` has one consumer, trivial composition, and no live drift hazard.
The precedent argues against it, not for it.

## Consequences

- Shaders keep composing hpmath atoms inline. A reviewer who sees the same
  `snapToPixelX` / `extendToMinWidthX` sequence in `rect` and reaches for a
  "dedupe" should read this ADR first: the sequence is shared where it matters
  (the atoms) and the composition is single-consumer.
- The reverse-strand flip-model divergence between canvas (upstream, negated
  `bpRangeX`) and alignments (downstream, `flipX`) is untouched and remains
  correct as-is. See the flip-model memory and the handoff doc. Do not naively
  share alignments' `flippedQuadPos` into canvas (double-flip bug).
- This decision would be revisited only if (a) the third-party-plugin
  ergonomics case becomes real (a different argument, weighed on its own
  merits), or (b) the gated skeleton work reconciles the flip model and thereby
  manufactures multiple genuine consumers. Neither is a win for the core
  codebase today.
