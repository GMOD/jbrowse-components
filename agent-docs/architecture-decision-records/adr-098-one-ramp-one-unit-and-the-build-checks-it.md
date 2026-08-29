---
status: Accepted
summary: "CSS px in, device px out, and the conversion is one number every antialiased shader owes. It was spelled four ways — `2.0 * aaHalfPx(dpr)`, `STROKE_AA_PX / max(dpr, 1)`, and two bit-identical wrappers named `capsuleCoverage` and `strokeCoverage` — while two shaders skipped it entirely and were wrong by a factor of dpr, invisibly on the dpr-1 machines people develop on. One `edgeCoverage`, one `devicePixelRatio` field name, and `assertDprDeclared` in `pnpm gen:shaders` fails a shader that reaches the conversion without declaring the ratio. Tightening the pads that stated CSS px cuts 29-61% of shaded fragments off connectors and scatter discs"
---

# ADR-098: one ramp, one unit, and the build checks it

## Status

Accepted, 2026-08-29.

## Context

Coordinates in this tree's shaders are **CSS px**. The framebuffer is **device
px**: the HAL sizes the backing store by `getDpr()` and sets the viewport to
`canvas.width/height`. Every mark fades its edge over one *output* pixel, so
every antialiased shader has to convert between the two, and the conversion is
one number — `1 / dpr`.

That number was spelled four ways. `antialias.slang` had `aaHalfPx(dpr)` and
callers wrote `2.0 * aaHalfPx(dpr)` for the full width; `alignmentsUniforms.slang`
had `STROKE_AA_PX / max(dpr, 1.0)` with `STROKE_AA_PX = 1.0`; `capsule.slang`
wrapped the first as `capsuleCoverage` and alignments wrapped the second as
`strokeCoverage`. The two wrappers are the same function — bit-identical, since
`2*(0.5/x)` and `1/x` differ only by an exact power-of-two scaling — under two
names, in two modules, sized by two constants, each with its own generated JS
twin and its own test importing a different one.

Two shaders skipped the conversion entirely. `manhattan.slang` had **no dpr
uniform at all**: it padded its glyph quad by a flat `AA_PAD_PX = 1.0`,
documented as device px and applied in CSS px, which is twice the ramp's reach
at dpr 1 and four times at dpr 2. `variant.slang` faded its inversion triangles
with `smoothstep(-0.5, 0.5, d)` over a CSS-px distance — the wrong width *and*
the cubic shape this module measured and rejected.

Both were found by reading. That is the part that does not scale, and it is the
actual problem: **a dpr bug is invisible on the machine most people develop on**,
where dpr is 1 and every wrong conversion is off by a factor of one.

## Decision

**One function performs the conversion, and reaching it obliges you to declare
the ratio.**

- `aaPx(dpr)` is the full ramp width in CSS px. `aaHalfPx(dpr)` is half of it,
  which is exactly how far a vertex stage must pad its quad. `edgeCoverage(
  signedInkCssPx, dpr)` is the only edge ramp. `capsuleCoverage` and
  `strokeCoverage` are gone; `STROKE_AA_PX` is gone.
- The dpr uniform is spelled `devicePixelRatio` everywhere, because a check
  cannot follow a synonym.
- `assertDprDeclared` runs inside `pnpm gen:shaders`: a shader whose **emitted**
  source calls a converter must declare `devicePixelRatio`, and a block no
  shader compiled against it reads is dead and must go. Emitted, not source, so
  a call inlined out of an imported module counts.

The generated `writeUniforms` packer closes the other half by itself: the field
is required, so TypeScript fails the renderer that does not supply it, and
`getDpr()` is the value every drawing path already owes.

## Consequences

A new shader cannot antialias without a dpr, and cannot carry a dpr it does not
use. Neither manhattan's missing uniform nor variant's hand-rolled smoothstep is
expressible now — the first fails the build, the second is what the check's own
error message names.

The pads that were stated in CSS px are now the reach, which is a real cut in
shaded fragments: 29% at dpr 1 and 43% at dpr 2 off a linked-read connector's
quad, and 44%/61% off a 1px-radius scatter disc's. The surplus was shading to
alpha 0 and blending anyway.

**The check is one-directional on purpose.** It catches the shader that reaches
the conversion without the ratio. It cannot catch one that hand-rolls the
arithmetic and never calls in — `smoothstep(-0.5, 0.5, d)` is invisible to it,
which is why that one had to be converted rather than merely detected. The
reverse rule stops at "declared and never read", because antialiasing is not the
only honest use of the ratio: variants' matrix snaps column edges to the device
grid, a conversion with no ramp in it, and insisting every reader route through
`antialias` would assert a claim about intent that the emitted source cannot
settle.

**What this does not settle**: `rowRect`'s min-cell floor, whose denominator two
callers feed in CSS px and one in device px, so MAF's floor moves with the
reader's monitor. That is a live question with an aesthetic half
([ideas/maf-subpixel-cells.md](../ideas/maf-subpixel-cells.md)) and fixing the
dpr-dependence alone is the wrong move, so the uniform is named
`minCellDenomPx` — for the thing that decides its unit — and the disagreement
now reads at every call site instead of in a comment forty lines away.

`coverageIndicator.slang`'s `smoothstep` fade stays too, and is not an
oversight: it is a stated softness knob spread over about 1.5 CSS px, a design
dimension rather than an edge ramp, and 1 CSS px is the same physical width at
any dpr.
