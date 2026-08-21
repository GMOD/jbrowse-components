---
status: Accepted
summary: "The thin-fade is a view-wide boolean, so the decision changing moves every sub-pixel ribbon at once; swept over both shipped files no flip repaints 50 ribbons at twice the ink, a strength ramp cannot reach zero on a mean bounded by its own cap, an eased uniform costs a clock against the readiness gate, and a deadband on the block-count bar was built and reverted because all 11,247 of its divergences leave a near-empty view faded"
---

# ADR-085: The thin-fade decision snaps, and that is the shipped answer

## Status

Accepted (2026-08-21). Settles what
[ADR-083](adr-083-the-auto-thin-fade-averages-capped-widths.md) left open —
that ADR chose the criterion and measured the decision, not what the decision
changing looks like. The fade itself is
[ADR-033](adr-033-synteny-lod-prune-at-data-draw-crisp-at-shader.md).

## Context

`LinearSyntenyView.fadeThinAlignments` is one boolean for the whole view, and
every non-CIGAR, non-marker ribbon narrower than a pixel reads it.
`WIDTH_FADE_FLOOR` is 0.15, so the decision changing moves a sub-pixel ribbon's
alpha by up to 0.85, and moves every one of them in the same frame.

That is a different complaint from the one `f48af92b65` and ADR-083 answered.
Those were about the decision changing *too often*. This is about what the change
looks like when it is correct, and it stayed open because the GPU side is nearly
free: `Uniforms.fadeThinAlignments` is **already a `float`**, `writeUniforms`
puts `p.fadeThinAlignments ? 1 : 0` in it and `syntenyTypes.slang` reads it back
as `u.fadeThinAlignments >= 0.5`. Only the two ends round it, and the fade is one
line either way:

```
// today
return applies ? clamp(perpW, WIDTH_FADE_FLOOR, 1.0) : 1.0;
// with a strength
return mix(1.0, clamp(perpW, WIDTH_FADE_FLOOR, 1.0), strength);
```

## Decision

**Nothing changes. The decision stays a boolean and the transition stays a
snap.** One threshold pair, one volatile, one autorun, and the rendered output
stays a function of the decision alone — which is what makes a golden
reproducible.

The measurement that settles it weights every flip by what was on screen to
repaint, over both shipped files, every chromosome, 24 zooms each, panned end to
end in a 1000 px view against the shipped `cappedMeanWidthPx` + `fadesThinAt` +
latch:

| | `peach_grape.paf` | `hg38ToHs1.over.pif` |
| --- | --- | --- |
| whole-chromosome pans | 135 | 522 |
| visible decision flips | 11 | 1,323 |
| ...repainting ≥20 ribbons at ≥1.5x ink | 4 | 4 |
| ...repainting ≥50 ribbons at ≥2x ink | **0** | **0** |
| loudest single flip | 57 ribbons, 1.67x | 11 ribbons, 3.14x |

**Nothing in either corpus repaints a hairball.** The 0.85 above is the worst
case for one ribbon in a state the view never *enters* as a transition — the
3.8x to 6.6x ink cliffs all sit deep inside the faded regime, at zooms where the
decision does not move.

One number in the note this replaces was wrong in a way that mattered: panning
Pp01 at the threshold zoom does not step the decision once, it steps it **zero**
times. The change a naive count sees lands at pan position 0.0 Mb and is the
latch recording a value the getter already returns — `fadesThinAt(0.967, false)`
and `fadesThinAt(0.967, true)` are both true, so no pixel moves. The getter's own
docstring says as much.

## Alternatives, all measured and declined

- **A strength ramp, and no threshold at all.** `autoFadeWidthPx` maps to a
  strength in [0, 1], the boolean disappears, and the hysteresis goes with it
  since there is no longer an edge to sit on. **It cannot be built on the
  statistic that ships.** A capped mean cannot exceed its cap, so the signal is
  bounded above by `FADE_WIDE_BLOCK_PX` = 2 by construction — the largest value
  either file produces anywhere is 1.909 px, on Pp01 at a 0.1 Mb view. A ramp band
  topping out at 2 px therefore never reaches strength 0: every view stays
  permanently at least slightly faded, `'auto'` can never look like `'off'`, and
  every figure at every zoom shifts. Widening the band means raising the cap,
  which ADR-083 measured as moving the statistic by more than the threshold it is
  compared against, so this is a recalibration of the criterion wearing a
  one-line shader edit. Two objections stand behind that and survive a raised
  cap: 1 → 1.25 px is calibrated to clear an 11.3% rollover step and is far too
  narrow to ramp across, and a continuous strength makes every golden depend on
  the fetch window — any change to the pan buffer, the snap grid or the worker's
  cull then shifts the alpha of every sub-pixel ribbon in every figure taken at a
  partially-faded zoom, and `compare-backends.ts` plus the figure goldens compare
  pixels.
- **Easing the uniform from 0 to 1 over ~200 ms on a flip**, leaving the
  decision, the latch and the thresholds alone. The cheapest-looking option, and
  the only one whose golden after the ease settles is byte-identical to today's.
  The cost is a clock: nothing in the synteny render path animates, so repaints
  happen while nothing else has changed and `data-display-drawn` plus the capture
  harness have to treat an easing display as not yet settled, or every screenshot
  races on which frame it caught — the class of problem
  [ADR-076](adr-076-a-shared-canvas-answers-readiness-twice.md) was about. Declined
  on what it would be easing: the sweep found no flip that repaints a hairball,
  and on the file where flips are frequent an ease turns 16 snaps per pan into 16
  crossfades rather than removing them.
- **A deadband on the block-count bar** (`FADE_AUTO_MIN_FEATURES`, engage at 10
  and hold at 5). **Built, tested and reverted**, and the most instructive of the
  four. The complaint is real and sharper than the width's: 1,105 of
  `hg38ToHs1`'s 1,323 flips cross the count bar rather than the width, and 173 of
  the 204 that change on-screen ink by 2x or more. It has no deadband where the
  width has one, and it does not flip the way the width does — a display under
  the bar contributes no width at all, so the decision goes straight from off to
  whatever the mean already says (0.397 px at the crossing on chr1) and every
  sub-pixel ribbon moves the whole way in one frame. Holding at 5 halves the loud
  half, 204 → 106, and takes the worst single pan from 16 flips to 11. Then
  enumerate the *positions* where the hold disagrees with a plain bar rather than
  the flips it removes: **all 11,247 are `full` → `faded`, and the median one has
  two visible ribbons**, 93% four or fewer, the most anywhere 19. The deadband
  does not steady a hairball. It keeps the fade on while the reader pans through a
  near-empty stretch, leaving one to four hairlines at `WIDTH_FADE_FLOOR` — which
  is verbatim what the ten-block bar exists to prevent. ADR-083 declined the same
  alternative on the flip count; the magnitude is the stronger reason.

## Consequences

- **The count-bar flips are not a defect.** A chain file's density genuinely
  swings between hairball and nearly empty within one chromosome, and a decision
  that tracks it has to swing too. A flip needs enough population to cross the
  bar, so the flips a sweep samples are the densest moments in a sparse region
  while the positions between them are much emptier — which is why the flip
  table's own visible-ribbon column reads 7 to 11 over a median of 2. Score a
  proposed deadband by the states it holds, not the transitions it removes.
- **The zoom crossing stays too.** Zooming through the threshold snaps the stack
  once; hysteresis stops it oscillating, not stepping. Measured on Pp01 that is a
  1.24x to 1.27x ink step over about 33 ribbons, on demand, mid-gesture, where the
  whole picture is already moving — smaller than the pan flips an ease was aimed
  at.
- **`WIDTH_FADE_FLOOR` and the tile branch are untouched by any of this, and a
  strength must never reach the tile branch.** `isTileKind` returns
  `min(perpW, 1.0)` unconditionally and with no floor, because N tiles of width w
  over one pixel composite back to just under a single band's alpha only if each
  is faded by its own width, and the floor would re-inflate that product (2.75x,
  measured in `syntenyTypes.slang`). `syntenyTiledInk.test.ts` pins tiles as
  identical with the flag on and off, and should stay passing untouched by
  anything reopened here.
- **Every number here is arithmetic from the two files.** As in ADR-083, what is
  measured is the decision, not whether the faded hairball reads better than the
  unfaded one. Nobody has yet put the two pictures side by side, and that capture
  — a question about the fade rather than about its transitions — is the one still
  worth taking.

## Related

- ADR-083 (the capped mean, and why the decision is stable enough for this to be
  a snap nobody sees), ADR-033 (the fade itself, and why indels stay solid)
- `reference/REJECTED_IDEAS.md` (the three statistics tried instead of capping,
  and a pointer back here)
