---
name: synteny-thin-fade-snap
description: The synteny thin-fade is a view-wide boolean, so the decision changing moves every sub-pixel ribbon between full alpha and WIDTH_FADE_FLOOR in one frame — and swept over both shipped files, no flip repaints 50 ribbons at twice the ink, the strength ramp cannot be built on a mean bounded by its own cap, the timed ease buys a clock against the readiness gate, and a deadband on the block-count bar leaves two hairlines faint to stop a flip nobody sees. Read before proposing any of the four again.
---

# What should happen when the thin-fade decision changes

`fadeThinAlignments` is one boolean for the whole view, and every non-CIGAR,
non-marker ribbon narrower than a pixel reads it. `WIDTH_FADE_FLOOR` is 0.15, so
the decision changing moves a sub-pixel ribbon's alpha by up to 0.85, and moves
every one of them in the same frame. That is the pop this doc is about. It is
not the flicker ADR-083 and `f48af92b65` were about — those were about the
decision changing *too often*; this is about what the change looks like when it
is correct.

**All three arms below are declined, and the capture they were parked on is not
needed to decline them.** Weighting each flip by what was on screen to repaint
answers the first arithmetically, and the second turns out not to be buildable on
the statistic that ships. The sweep also killed the obvious follow-on — a
deadband on the block-count bar — for a reason worth reading before proposing it
again.

## The sweep

Both shipped files, every chromosome, 24 zooms each, panned end to end in a 1000
px view against the shipped `cappedMeanWidthPx` + `fadesThinAt` + latch:

| | peach_grape | hg38ToHs1 |
| --- | --- | --- |
| whole-chromosome pans | 135 | 522 |
| visible decision flips | 11 | 1,323 |
| ...repainting ≥20 ribbons at ≥1.5x ink | 4 | 4 |
| ...repainting ≥50 ribbons at ≥2x ink | **0** | **0** |
| loudest one | 57 ribbons, 1.67x | 11 ribbons, 3.14x |

Nothing in either corpus repaints a hairball. The 0.85 above is the worst case
for one ribbon in a state the view never *enters* as a transition: the 3.8x–6.6x
ink cliffs all sit deep inside the faded regime, at zooms where the decision does
not move.

One number here corrects the note this doc replaces. Panning Pp01 at the
threshold zoom does not step the decision once; it steps it **zero** times. The
one change a naive count sees lands at pan position 0.0 Mb and is the latch
recording a value `fadeThinAlignments` already returns — `fadesThinAt(0.967,
false)` and `fadesThinAt(0.967, true)` are both true, so no pixel moves. The
getter's own docstring says as much.

## Why the GPU side is nearly free

Still true, and the reason this stayed open as long as it did.
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
tiles as identical with the flag on and off.

## A: keep the snap, keep the latch — chosen

What ships. One threshold pair per bar, one volatile, one autorun. The only
candidate whose rendered output is a function of the decision alone, which is
what makes a golden reproducible, and by the sweep above the pop it leaves is not
one a reader can find.

## B: a strength ramp, and no threshold at all — cannot be built as stated

`autoFadeWidthPx` maps to a strength in [0, 1], the boolean disappears, and the
hysteresis goes with it since there is no longer an edge to sit on.

**A capped mean cannot exceed its cap.** `FADE_WIDE_BLOCK_PX` is 2, so the signal
a strength would ramp over is bounded above by 2 by construction — the largest
value either shipped file produces anywhere is 1.909 px, on Pp01 at a 0.1 Mb
view. A ramp band topping out at 2 px therefore never reaches strength 0: every
view stays permanently at least slightly faded, 'auto' can never look like 'off',
and every figure taken at any zoom shifts. Widening the band means raising the
cap, and ADR-083 measured that an effective cap wobbling between 2 and 4 px moves
the statistic by more than the threshold it is compared against. **B is a
recalibration of the criterion wearing a one-line shader edit.**

Two objections stand behind that one, and both survive a raised cap:

- **A deadband and a ramp want different widths.** 1 → 1.25 px is calibrated to
  clear the rollover step in the signal (at most 11.3% on the capped mean), which
  is exactly what makes it far too narrow to ramp across. A ramp needs a band
  several times the noise, which is a new calibration against pictures, and it
  partially fades a range of views that today are not faded at all.
- **A continuous strength makes a golden depend on the fetch window.** With a
  boolean, a small change in the fetched population is absorbed — away from the
  threshold the decision is the same and the pixels are identical. With a ramp,
  any change to the pan buffer, the snap grid or the worker's cull shifts the
  alpha of every sub-pixel ribbon in every figure taken at a partially-faded
  zoom, and `products/jbrowse-web/browser-tests/compare-backends.ts` plus the
  figure goldens compare pixels. That is a standing tax on unrelated work, paid
  in figure regens.

## C: keep the threshold, ease the uniform

Leave the decision, the latch and the thresholds exactly as they are, and ease
the uniform from 0 to 1 over ~200 ms when it flips. No new number to calibrate,
no change to which views are faded, and a golden captured after the ease settles
is byte-identical to today's — the property B gives up.

The cost is a clock. Nothing in the synteny render path animates: the only
`requestAnimationFrame` uses nearby are the pick engine's schedule and
`useTabVisibilityRerender`. An ease means repaints while nothing else has
changed, and it has to interact with readiness — `data-display-drawn` and the
capture harness would need to treat an easing display as not yet settled, or
every screenshot becomes a race on which frame it caught. That is the same class
of problem `adr-076` and the display-phase work were about.

Declined on what it would be easing. The sweep found no flip that repaints a
hairball, so C would spend the readiness interaction smoothing transitions of 7
to 57 ribbons — and on the file where flips are frequent it would turn 16 snaps
per pan into 16 crossfades rather than removing them.

## The count bar is not a missing deadband

Worth writing down, because it looks like one. Of `hg38ToHs1`'s 1,323 flips,
**1,105 cross `FADE_AUTO_MIN_FEATURES` rather than the width**, and 173 of the
204 that change on-screen ink by 2x or more. It has no deadband where the width
has one, and it does not even flip the way the width does: a display under the
bar contributes no width at all, so the decision goes straight from off to
whatever the mean already says — 0.397 px at the crossing on chr1 — and every
sub-pixel ribbon moves the full 1 → `WIDTH_FADE_FLOOR` in one frame. Holding the
bar at 5 once engaged halves the loud half (204 → 106) and takes the worst single
pan from 16 flips to 11.

**Build it and it is worse, on the axis the bar was chosen for.** Every one of
the 11,247 sampled pan positions where a hold at 5 disagrees with what ships is
`full → faded`, and the median one has **two visible ribbons**; 93% have four or
fewer, and the most anywhere is 19. So the deadband does not stabilise a
hairball. It keeps the fade on while the reader pans through a near-empty region,
leaving one to four hairlines at 0.15 alpha — which is verbatim what
`FADE_AUTO_MIN_FEATURES` exists to prevent.

The flips are the criterion working. A chain file's density genuinely swings
between hairball and nearly empty within one chromosome, and a decision that
tracks it has to swing too. Counting the flips makes that look like instability;
looking at what each one repaints, and at what the alternative would leave on
screen between them, does not. ADR-083 declined this alternative on the flip
count; the magnitude is the stronger reason.

## What is actually left

Two things, neither of them A/B/C:

- **The zoom crossing.** Zooming through the threshold snaps the stack once —
  hysteresis stops it oscillating, not stepping. Measured on Pp01 it is a 1.24x
  to 1.27x ink step over about 33 ribbons, and it happens on demand, mid-gesture,
  where the whole picture is already moving. Smaller than the pan flips C was
  aimed at.
- **Whether any of this is visible at all.** Every number in this doc and in
  ADR-083 is arithmetic from the two files. Nobody has yet put the
  faded chain-file hairball beside the unfaded one and looked. That is the
  capture worth taking, and it is a question about the fade, not about its
  transitions.

## Related

- ADR-083 (the capped mean, and why the width decision is stable enough that this
  is closed), ADR-033 (the fade itself, and why indels stay solid)
- `reference/REJECTED_IDEAS.md` — the three statistics tried instead of capping
