---
name: synteny-thin-fade-snap
description: The synteny thin-fade is a view-wide boolean, so the decision changing moves every sub-pixel ribbon between full alpha and WIDTH_FADE_FLOOR in one frame; the shader uniform is already a float, so a strength ramp and a timed ease are both small changes — with the measured reason neither is obviously better than the latch that ships, and the capture that would settle it.
---

# What should happen when the thin-fade decision changes

`fadeThinAlignments` is one boolean for the whole view, and every non-CIGAR,
non-marker ribbon narrower than a pixel reads it. `WIDTH_FADE_FLOOR` is 0.15, so
the decision changing moves a sub-pixel ribbon's alpha by up to **0.85, and moves
every one of them in the same frame**. That is the pop this doc is about. It is
not the flicker ADR-083 and `f48af92b65` were about — those were about the
decision changing *too often*; this is about what the change looks like when it
is correct.

Where it is left, measured on `peach_grape.paf`'s Pp01 in a 1000 px view at the
zoom that sits on the threshold (0.96 Mb):

| | value |
| --- | --- |
| fetch-window rollovers per whole-chromosome pan | 25 |
| decision changes per that pan, capped mean + latch | 1 |
| of those, between two windows each holding 50+ blocks | 0 |
| alpha step when one does happen | up to 0.85, view-wide |

So the pop is now **rare and lands where the view is thin**. That is the reason
this is parked rather than queued: the machinery below removes a transition the
reader mostly does not see any more.

There is a second pop the latch does nothing about. Zooming through the threshold
snaps the stack once — hysteresis stops it oscillating, not stepping — and that
one happens on demand, in the middle of a gesture where the whole picture is
already moving.

## Why the GPU side is nearly free

`Uniforms.fadeThinAlignments` is **already a `float`**. `writeUniforms` puts
`p.fadeThinAlignments ? 1 : 0` in it and `syntenyTypes.slang` reads it back as
`u.fadeThinAlignments >= 0.5`, so the wire already carries a number and only the
two ends round it. The fade itself is one line:

```
// today
return applies ? clamp(perpW, WIDTH_FADE_FLOOR, 1.0) : 1.0;
// with a strength
return mix(1.0, clamp(perpW, WIDTH_FADE_FLOOR, 1.0), strength);
```

**The tile branch must not move.** `isTileKind` returns `min(perpW, 1.0)`
unconditionally and with no floor, and that is arithmetic rather than taste: N
tiles of width w over one pixel composite back to just under a single band's
alpha only if each is faded by its own width, and the floor is what would
re-inflate the product (`syntenyTypes.slang` carries the 2.75x measurement).
A strength that reached the tile branch would break ink conservation in
colored-indel mode. `syntenyTiledInk.test.ts` is what holds that, and it pins
tiles as identical with the flag on and off — so it should keep passing untouched
by any of this.

## A: keep the snap, keep the latch

What ships. One threshold pair, one volatile, one autorun, and the pop above.
Cheapest to reason about and the only candidate whose rendered output is a
function of the decision alone — which is what makes a golden reproducible.

## B: a strength ramp, and no threshold at all

`autoFadeWidthPx` maps to a strength in [0, 1] and the boolean disappears.
`fadeThinLatch`, `setFadeThinLatch`, `installAutoFadeLatch`, `fadesThinAt` and
both threshold constants go with it — hysteresis is only needed because there is
an edge to sit on. `'on'` and `'off'` become 1 and 0, and the config slot keeps
its three-way enum.

Two things make this less of a giveaway than it looks.

**A deadband and a ramp want different widths.** 1 → 1.25 px is calibrated to
clear the rollover step in the signal (measured at most 11.3% on the capped mean),
which is exactly what makes it far too narrow to ramp across: an 11.3% step
inside a 25% band moves the strength by nearly half its range. A ramp needs a
band several times the noise — something like 2 px down to 0.5 px — which is a new
calibration against pictures, and it partially fades a range of views that today
are not faded at all. Over that band an 11.3% step near 1 px moves the strength
about 7.5%, i.e. **~0.06 of alpha, at each of the 25 rollovers in a chromosome
pan** instead of 0.85 once. Whether a hairball breathing by 6% is better than one
clean step is the question, and it is a picture question.

**A continuous strength makes a golden depend on the fetch window.** With a
boolean, a small change in the fetched population is absorbed — the decision is
the same and the pixels are identical. With a ramp, any change to the pan buffer,
the snap grid or the worker's cull shifts the alpha of every sub-pixel ribbon in
every figure taken at a partially-faded zoom, and `products/jbrowse-web/browser-tests/compare-backends.ts`
plus the figure goldens compare pixels. That is a standing tax on unrelated work,
paid in figure regens.

## C: keep the threshold, ease the uniform

The pop is a transition, so treat it as one: leave the decision, the latch and the
thresholds exactly as they are, and ease the uniform from 0 to 1 over ~200 ms when
it flips. No new number to calibrate against pictures, no change to which views
are faded, and a golden captured after the ease settles is byte-identical to
today's — the property B gives up.

The cost is a clock. Nothing in the synteny render path animates: the only
`requestAnimationFrame` uses nearby are the pick engine's schedule and
`useTabVisibilityRerender`. An ease means repaints while nothing else has changed,
and it has to interact with readiness — `data-display-drawn` and the capture
harness would need to treat an easing display as not yet settled, or every
screenshot becomes a race on which frame it caught. That is the same class of
problem `adr-076` and the display-phase work were about, and the reason this is
not obviously the cheap option it first looks like.

## The capture that would decide

One pan and one zoom, filmed at 1000 px on `peach_grape.paf` at 0.96 Mb — the
threshold zoom, where A steps once and B would step 25 times — and the same pair
on `hg38ToHs1.over.pif` at 10 Mb, where ADR-083's capped mean newly engages and
the population swings hardest. Three arms, same route:

1. as it ships, and note whether the single step is even findable;
2. with a strength ramp over [0.5, 2] px, and note whether the breathing is;
3. with a 200 ms ease on the existing decision.

If the step in arm 1 is hard to find, none of this is worth building, and that is
the likely outcome now that the loud-flip count is 0. Arm 2 answering "invisible"
would be the only result that justifies giving up golden stability.

## Files it would touch

Either of B or C reaches: `syntenyTypes.slang` (plus its three generated files —
regenerate with `pnpm gen:shaders`, and check its exit code),
`GpuSyntenyRenderer.writeUniforms`, `Canvas2DSyntenyRenderer` (whose
`thinWidthFade` argument is a `bool` today), `syntenyRenderingBackendTypes`, the
display's `renderParams`, and `LinearSyntenyView.fadeThinAlignments`. Tests that
assert the flag as a boolean: `syntenyShaderParity`, `syntenyTiledInk`,
`Canvas2DSyntenyRenderer` ("keeps full alpha regardless of width"),
`GpuSyntenyRenderer`, and the pick/SVG fixtures that set it.

## Related

- ADR-083 (the capped mean, and why the decision is stable enough that this is
  parked), ADR-033 (the fade itself, and why indels stay solid)
- `reference/REJECTED_IDEAS.md` — the three statistics tried instead of capping
