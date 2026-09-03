---
name: arc-foot-bound-and-the-y-offset-band
description: The breakend-foot region bound is written but UNCOMMITTED in the worktree with one bad import, so the tree neither builds nor reverts cleanly — it needs a one-line import fix and the checks below. Beside it, the track-y-offset label-box research is done and refutes its own idea doc's recommended fix, so that thread waits on an approach decision, not on more digging.
---

# The arc foot bound (uncommitted) and the y-offset label band

Two threads from the 2026-09-03 pass over `ideas/`. The first is a **dirty
worktree** and should be closed before anything else; the second is finished
research waiting on a decision.

## 1. Breakend-foot region bound — written, uncommitted, one bad import

Implements
[`ideas/bound-a-breakend-foot-by-its-displayed-region.md`](../ideas/bound-a-breakend-foot-by-its-displayed-region.md).
Nine modified files plus one untracked test, none committed:

- `features/arcs/mark.ts` — `ArcFeet` grows `leftLen`/`rightLen`,
  `ProjectedArc.feet` grows `len1`/`len2`, and `arcMarkFrom` sorts the lengths
  onto left/right through the same `sx1 <= sx2` compare that already sorts the
  directions, so a length always travels with its own direction.
- `features/arcs/crossRegionOverlay.ts` — new `regionScreenExtent` option; a
  `footLength(sx, dir, extent)` helper returns
  `min(ARC_FOOT_PX, dir > 0 ? extent.right - sx : sx - extent.left)` floored at
  0. Both `sx` and `dir` are already screen-space there.
- `features/arcs/arcPath.ts` — `feetSubpaths` traces `feet.leftLen`/`rightLen`
  and skips a foot of length 0; `ARC_FOOT_PX` is now a **maximum**.
- `LinearAlignmentsDisplay/model.ts` — `crossRegionArcSections` projects each
  displayed region's `start`/`end` once per resolve into `extentByRegion`,
  beside the existing `reversedByRegion`.
- `LinearAlignmentsDisplay/overlaySections.ts` threads the option through.
- Three existing `computeCrossRegionArcs` tests get
  `regionScreenExtent: () => undefined`; `arcFeetPath.test.ts` passes explicit
  lengths and its comment now points at the new test.

**The one break.** `features/arcs/crossRegionFeetBound.test.ts` (new, untracked)
imports `makeTestPalette` from `./crossRegionTestPalette.ts`, which does not
exist. It lives at `LinearAlignmentsDisplay/testUtils.ts:37` and that is the
path the sibling `crossRegionHitTarget.test.ts` already uses. `eslint --fix`
sorts the import block afterwards.

**Then:**
`npx jest plugins/alignments/src/features/arcs plugins/alignments/src/LinearAlignmentsDisplay`,
`pnpm typecheck` (the new `ArcFeet` fields are required, so a missed producer is
a type error), lint `--fix`, `pnpm format`, `pnpm test-related`. Delete the idea
doc and `pnpm autogen`.

**`--with-web` is not owed** — no config slot, menu, label or snapshot shape
moves. Confirmed the only `.snap` files carrying elliptical-arc path commands
are the circular-genome-view ones, which are a different plugin's chord paths.

**The one test at risk is `arcBreakendFeet.test.ts`**, because it drives the real
model and so now gets real extents. Checked by hand and it is safe: two 10 kb
regions at bpPerPx 40 make each region 250 px wide, the ctgA read sits 25 px
from its region's left edge and the ctgB mate 50 px in, so both clear a 20 px
foot in the forward and `reverseSecondRegion` cases. If it goes red, read the
fixture margin, not the bound.

**Do not bound a foot by the other foot's anchor.** That version looks
equivalent, was written, and was reverted: two feet pointing the same way must
keep overrunning each other, because they overlap precisely when both ends keep
the same stretch. `arcFeetPath.test.ts` pins it.

**Cost, which the idea doc asked to measure:** the ratio answers it without a
bench — two projections per displayed region (1–10) once per resolve, against
two per arc for up to `CROSS_REGION_ARC_CAP` arcs (600–5000 in the regime the
cap exists for).

**Accepted edge:** `makeBpToScreenX` falls back to an unindexed `view.bpToPx`
when the indexed lookup misses, so an endpoint can project outside the extent
its own `p1RegionIndex` names; `footLength` floors at 0, so the foot draws
nothing rather than pointing the wrong way — the safe direction for a mark whose
whole content is a direction, in a case where that claim was already unreliable.

## 2. The track y-offset label band — research done, refutes its own idea doc

For
[`ideas/track-y-offset-cannot-see-the-label-box.md`](../ideas/track-y-offset-cannot-see-the-label-box.md).
`getTrackYOffset` (`LinearGenomeView/model.ts:1093`) sums
`trackHeight(t) + trackChromeHeight`, and `trackChromeHeight` (`:1000`) is the
gap, resize handle and borders — everything `TrackContainer` lays out except the
label. **Fold these five findings into that idea doc when the thread is taken,
and delete this file.**

- **The doc's own "cheapest" option is a trap.** It proposes returning
  `undefined` when labels show. The signature is _already_ `number | undefined`,
  and the single call site reads
  `yOffsetsOverride?.[level] ?? domYOffsets?.[level] ?? viewTop + (view.getTrackYOffset(trackId) ?? 0)`
  (`BreakpointSplitView/model.ts:466`). The `?? 0` swallows it and `viewTop + 0`
  means "this body starts at the top of the row" — exactly the failure
  `BreakpointSplitViewOverlay.tsx:11-15` documents as its reason for measuring
  `undefined` rather than `0`. Making it honest means changing
  `OverlayLevel.yOffset` to nullable, `computeOverlayY` and its six tests, the
  documented clamp invariant, and every overlay kind's drop path — larger than
  the fix it was meant to avoid.
- **The deficit is inclusive, so both docstrings are off by one.** `y` starts at
  the first Paper's content top, and each track's own label sits in flow above
  its rendering container inside its Paper — so the shortfall is one band per
  labelled track **at or above** the requested one, `(i+1) × band`. The getter's
  docstring and the idea doc both say "above this one".
- **`prefersOffset` is not what turns offset labels on.** `'offset'` is the
  config default for every track (`plugin-linear-genome-view/src/index.ts:45`);
  `prefersOffset` only overrides when the user has chosen `'overlapping'`. The
  inexact case is the default for all tracks, not a per-display quirk.
- **The band is not the label's height.** `trackLabelOffset` is `inline-block`
  with `marginBottom: 8` (`TrackContainer.tsx:66`), so the push is a line box
  and `label.height + 8` is an approximation. The exact quantity is
  `renderingContainer.top − paper.top`, the same delta `useDomTrackYOffsets`
  already takes one level up.
- **Fixing `getTrackYOffset` fixes level 0 only.** `viewTop` accumulates
  `view.height` (`model.ts:1069` → `trackHeightsWithChrome` `:1062`), which
  carries the identical omission, so a multi-row fallback stays short by every
  band in the rows above unless `height` is treated too. `height`'s other
  consumer is only a lazy-mount scroll placeholder
  (`app-core/src/ui/App/ViewContainer.tsx:41`), which tolerates being wrong.

**Where the wrong number is actually reached** — `domYOffsets` is undefined, and
the arithmetic used, in four windows: the frames before the first
`requestAnimationFrame` measurement lands (the state starts `{}`); a
**minimized** track, which mounts no rendering-container ref but does still
render its label; a mid-remount frame (display-type swap, reorder, pin toggle);
and when the overlay's SVG ref is null.

**Nothing pins any of it.** No test references `getTrackYOffset`,
`trackChromeHeight`, `trackLeadingChrome`, `trackTrailingChrome` or
`domYOffsets`. The natural home for new tests is
`BreakpointSplitView/svgcomponents/util.test.ts`, which already asserts the
label band for the **export** path — "the first body starts below its own label
band" — the exact invariant `getTrackYOffset` violates.

**Helpers to reuse rather than reinvent.** `useChromeHeightVar`
(`core/src/util/hooks.ts:463`) is this exact pattern, `getBoundingClientRect()`
not `offsetHeight`, `ResizeObserver`, cleanup, and its docstring carries the
measured observer cost — but it publishes to a CSS custom property, which a
model getter cannot read. `useWidthSetter` (`hooks.ts:94`) is the precedent for
pushing a measurement into MST, including the `requestAnimationFrame` guard that
dodges the ResizeObserver-loop warning. `trackRefs` (`model.ts:538`, written by
a callback ref in `TrackRenderingContainer.tsx:121`) is the existing per-track
DOM registry — but a plain object mutated in place, so it is **not**
MobX-reactive and a sibling record written the same way would be invisible to
observers.

**The decision this waits on** is which fix to take, and it is a real one:
measuring the band into model state is the only option that makes the number
right, and it costs a per-label observer plus an answer to the reactivity
question above; taking the label out of flow ends the whole class of drift and is
a visual call on every labelled track; the doc's third option should be struck.
A cheap honest step, if one is wanted first, is the naming half alone — the
getter's name is the thing lying.
