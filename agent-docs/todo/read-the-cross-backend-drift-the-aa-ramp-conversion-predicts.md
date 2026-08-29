---
name: read-the-cross-backend-drift-the-aa-ramp-conversion-predicts
description: all four converted, but the capsule extraction has since moved the dotplot again and rewritten the wiggle-line control; re-baseline before reading a number
metadata:
  area: shaders, GPU
  category: ready
  order: 2
  first_move: "the capsule extraction (`8a9c288605`, 2026-08-29) moved two of the watched sites after the conversions, one of them the control — decide what the baseline is before running anything"
---

# Read the cross-backend drift the AA ramp conversion predicts

**All four conversions landed** — the dotplot capsule (`856cdbcd86`), synteny's
`perpCoverage` (`2edb510788`) and `vertCoverage` (`c95c98985c`), and
`glyphEdgeAlpha` (`71d557895a`), which took `aaSmoothRamp` out of the module with
it. What is owed is the measurement, and it is owed rather than skipped because
the change was posed as a falsifiable prediction.

The gate run was started and cut off partway (25 of 136 pairs), so there is no
number:

```sh
pnpm --filter @jbrowse/web build
cd products/jbrowse-web && node browser-tests/runner.ts \
  --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate --drift-report
```

A ramp closer to exact coverage should move those pairs **down** the distribution
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) records — 66
pairs, max 0.62%, median 0.00% — not merely somewhere else. `Dotplot View`,
`Synteny Views`, `Multi-Way Synteny Views` and `GWAS Tracks` are all in CI scope,
so all four sites are watched. The wiggle line plots at the top of that
distribution were already linear, so they are the control rather than the target.
**Neither the control nor the dotplot is still what that sentence says** — the
last section here is why.

**Two things a re-run needs that the first two attempts did not have.** Both
died to a *second* `browser-tests/runner.ts` running in the same worktree — one
was reaped at 117/136, the other wedged on `BigWig Tracks > GC content track`,
which the other run was filtered to, and that run's wrapper does
`rm -rf __snapshots__` before restoring its own goldens. So: check
`ps -Ao command | grep runner.ts` first, and take the gate on a quiet worktree.

**Revert order matters now.** `aaSmoothRamp` was deleted with its last caller,
because slang dead-code-eliminates an uncalled function out of every compiled
shader and `pnpm gen:shaders` then fails its own `//! js-skip` check for naming a
function no emitted shader contains. Reverting one of the three earlier
conversions alone therefore calls a function that the fourth commit removed. It
fails loudly at `gen:shaders` rather than silently, but revert the fourth first.

## Three cubic edge ramps never went through the module

The count of four was the count of `aaSmoothRamp` CALLERS, and it undercounts
cubic ramps: three shaders open-code the same one-pixel edge ramp without
reaching `antialias.slang`, so the coverage study's finding applies to them
unchanged.

- `plugins/variants/.../shaders/variant.slang:184` — `smoothstep(-0.5, 0.5, d)`
  on the inversion triangle's SDF. Watched suite: `Variants Track`.
- `packages/render-core/src/shaders/coverageIndicator.slang:59` —
  `smoothstep(0.0, 1.0, min(dLeft, dRight))`, and the variable is called `aa`.
- `plugins/canvas/.../passes/shaders/continuation.slang:235` —
  `1.0 - smoothstep(0.5, 1.5, edgePx)` off `fwidth`. **Read the comment above it
  first**: it says the Canvas2D twin has a stake in this one, so it "wants a
  capture and not a refactor".

Not in this set, and not to be swept up with it: `variant.slang:185`'s
`smoothstep(0.0, 3.0, min(w, h))`, `gap.slang:35` and `overlap.slang:51` are
FADES over several pixels rather than edge ramps over one. A cubic easing is a
defensible choice there and the coverage study says nothing about it.

**Hold the MSAA sample count fixed, or the number means nothing.** The
per-display sample count landed the same day (`bea2ae1546`) on the same
primitives — `glyphEdgeAlpha` sits behind `pointGlyph` and manhattan's SDFs, and
the MSAA-dependent set is wiggle/coverage bar tops, read arrow tips and the tiled
Hi-C/LD diamonds. A run spanning both changes produces a drift table neither
effort can attribute, so record the commit it was measured at. The antialiasing
section of [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) carries the
coverage table and this same warning.

## The capsule extraction moved two of the watched sites, one of them the control

`8a9c288605` (2026-08-29) pulled the capsule SDF the dotplot line renderer and
wiggle's linecenter each carried into a shared `capsule.slang`, and both now
shade through `capsuleCoverage`
([reference/SHADER_SHAPE_LIBRARY.md](../reference/SHADER_SHAPE_LIBRARY.md) is the
writeup). What matters here is only that it is **analytic** — wiggleLine's
fragment notes "nothing here takes a derivative" — so it is neither shape
`antialias.slang` offers, and it replaced the ramp at both sites.

Two consequences for the number this entry is owed, and they are different:

- **The dotplot moved twice.** `856cdbcd86` (2026-08-22) gave the capsule the
  linear ramp, which is the conversion this entry predicts a drop from;
  `8a9c288605` then replaced that ramp with analytic coverage. A run taken now
  measures the sum against a distribution recorded before either, and the
  prediction is about the first one alone.
- **The wiggle line is no longer a control.** It was one on the grounds that
  it was already linear and so should not move; `wiggleLine.slang` was
  rewritten in the same commit, so `BigWig Tracks` and `Wiggle Color Change`
  can now move for a reason that has nothing to say about the ramp.

`Synteny Views`, `Multi-Way Synteny Views` and `GWAS Tracks` are untouched by
this and still read as posed. So either take the prediction on those three and
say the dotplot is out of frame, or re-baseline the distribution at
`8a9c288605` first and give up the before/after on the dotplot entirely. What
does not work is quoting one run against the 66-pair table as though it
answered the question.
