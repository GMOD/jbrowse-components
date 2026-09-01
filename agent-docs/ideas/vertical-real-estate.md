---
name: vertical-real-estate
description: The "scrolls within scrolls" problem: a goodness hierarchy for the fixes, what the wheel/scroll machinery already does that you should not reinvent, a view-level height allocator, reclaiming non-data chrome, the publisher's own filter as a footprint lever, and an honest floor on what any of it buys.
---

# Vertical real estate & the "scrolls within scrolls" problem

The app nests scroll surfaces (page scroll, per-track synthetic scroll, horizontal
genome pan) in ways that fight the expectation of an easily scrollable web page.
`fit-to-display-height` already helps. This note captures where to push next.

### The goodness hierarchy

Rank the outcomes, best first:

1. **Everything fits the viewport → no scroll at all.**
2. **Doesn't fit → densify/summarize until it fits → still no scroll.**
3. **Genuinely can't summarize → scroll, made clean.**

Fit-to-height lives at levels 1-2; composite/nested scroll improvements live at
level 3. Level 1 beats level 3 unconditionally: eliminated scroll dominates
improved scroll. So the master lever is **minimizing vertical footprint**, not
making nested scroll nicer.

Why vertical is the right axis to optimize: the horizontal axis carries all the
meaning (it is the genome, navigated by pan/zoom); the vertical axis carries no
genomic information, it is pure stacking overhead. Every vertical pixel reclaimed
is returned to genome context and removes potential scroll. It is the only axis
where "use less" is strictly a win.

### What the current wheel/scroll machinery already does (don't reinvent)

Grounding check against the code corrected two tempting-but-wrong premises:

- `useWheelScroll.ts` already separates axes: plain wheel `deltaX` -> horizontal
  pan, `ctrl`/`meta` (or opt-in `scrollZoom`) -> zoom, `deltaY` -> the track's own
  vertical scroll. `trackPointerPresence` drops accumulation when the cursor
  leaves so gestures chain to the page. `scrollLatch.ts` reproduces native
  scroll-chaining. So "gesture ambiguity" is largely already solved.
- Per-track vertical scroll is **synthetic on purpose** (`TrackRenderingContainer`
  is `overflow: hidden`; each canvas display owns a sticky-canvas +
  `VerticalScrollbar` overlay redrawing at `scrollTop`). Native overflow here
  previously produced double/flickering scrollbars. So "unify into one native
  scroll surface" walks back into a fixed bug.

The residual pain is therefore **panel count and handoff**, not gesture
ambiguity - which is exactly why footprint reduction (fewer panels that need to
scroll) is the higher lever.

### Lever A: view-level height allocator (fit the whole stack, not each track)

Today heights are **bottom-up**: `LinearGenomeView.height` = `Σ trackHeight(t) +
chrome`, and `trackHeight(t)` (model.ts:1044) reads `display.height` (config slot,
or content-height in fit mode). Nothing constrains the sum to a viewport. Current
fit-to-height fits each track to *its own* content; ten content-fit tracks can
still overflow. The higher-lever version inverts to **top-down**: a budget `B` is
distributed across tracks so the whole stack targets the viewport.

Give each display three numbers instead of one:

- `naturalHeight` - what content wants (content height in fit mode; the pinned
  slot value if the user drag-resized)
- `minHeight` - `MIN_DISPLAY_HEIGHT`
- `allocatedHeight` - what the view grants

The display renders at `allocatedHeight`; internal scroll appears only when
`allocatedHeight < naturalHeight`.

Allocation is **water-filling / max-min fairness**:

```
B = availableViewportHeight − chrome (headers, scalebar, resize handles)

if Σ naturalHeight ≤ B:
    grant everyone naturalHeight        // level 1 — fits, no scroll, done
else:
    waterfill:                          // max-min fairness
      share = B / nTracks
      tracks wanting ≤ share keep their full naturalHeight
        and release their surplus back into the pool
      repeat with the remaining tracks + remaining budget
      the dense tracks split whatever's left, and only they scroll
```

This encodes the intuition: a 2-feature gene track costs 2 rows and shows whole;
a deep pileup absorbs the deficit and scrolls internally; the **stack** fits the
screen. Sweet spot is the common mixed session (genes + coverage + one pileup):
one-panel-scroll -> zero. Degrades gracefully to "fair small shares" when every
track is dense; when all are sparse, today's fit-to-height already handles it.

**Where it slots in:** `trackHeight(track)` at model.ts:1044 is already the single
chokepoint deciding a track's vertical box (it centralizes minimized-collapse).
It becomes:

```
trackHeight(track) = allocations.get(track.id) ?? track.displays[0].height
```

where `allocations` is one view-level MobX `computed` over
`tracks.map(naturalHeight)` and `B`, recomputing reactively as content heights
settle.

**Four real wrinkles:**

1. **Where `B` comes from** - embedded-vs-app split. Full app has a measurable
   fixed shell; embedded LGV often lives in an unbounded, grow-to-content
   container. So `B` must be **opt-in** (a `viewHeight`/budget config); unset ->
   fall back to today's bottom-up behavior (also makes it non-breaking).
2. **`naturalHeight` is async** - it comes from worker render/layout, so
   allocation is reactive, settling as data arrives (MobX computed handles it).
   Trap: `naturalHeight` must be the *unconstrained* content height, never
   derived from the current `allocatedHeight`, or fit-scaling displays (the
   wiggle fit-to-height path) oscillate. Displays must expose
   content-height-at-natural-density independent of what they're allocated.
3. **One resolved getter** (the `effectiveRowHeight` pattern from CLAUDE.md):
   every consumer - render container, SVG export (`svgcomponents/util.ts`
   `totalHeight`), y-offset walk, overlays - reads `allocatedHeight`, never the
   raw slot. `trackHeight()` already centralizes layout; route SVG export through
   it too.
4. **Drag-resize is a constraint, not a variable** - a user-pinned height enters
   the waterfill as fixed (compressed last, or not at all), else the allocator
   instantly undoes the drag. Maps onto the existing slot-set (pinned) vs
   slot-unset (fit) distinction.

### Lever B: reclaim non-data chrome (cheap, lossless)

Data density is the hard, lossy lever. Label bars, headers, resize handles, and
inter-track gaps are pure overhead with no genomic information, paid once per
track. Ten tracks x ~30px is a whole track's worth of genome context spent on
furniture. Overlaying labels onto data (floating-label machinery already exists),
thinning gaps, and collapsing headers is footprint savings with **zero
information loss**. Composes with Lever A: less chrome -> bigger `B` -> more fits
natively before the waterfill ever compresses anything.

### Lever C: don't draw what the publisher already hides

A track can arrive over-tall because its own publisher's default was dropped in
conversion, which is footprint spent on features nobody asked to see. UCSC's
trackDb carries `filter.<field>` defaults its browser applies before drawing, and
JASPAR is the case that shows the size of it: over the 2 kb around the TP53 start
site the file holds 9,899 motif matches and UCSC draws the 500 scoring >= 400
(measured 2026-08-13 against JASPAR2026.bb). Every one of those rows was vertical
real estate. jb2hubs cc48aa2802a derives those onto `jexlFilters`, which is a
level-2 outcome reached without touching the display at all.

Two things make this compose rather than just help:

- **The density gate already counts the admitted population.** Both the
  pre-fetch sample and the exact post-fetch count in
  `RenderFeatureDataRPC/executeRenderFeatureData.ts` take the same `admit`
  predicate the layout pass uses, so a filtered track measures as what it draws.
  A shipped filter therefore moves a track from behind a force-load prompt to
  drawn, not merely from tall to short.
- **The filter is visible and reversible.** "Filter by... (n)" carries the count
  and clears, so a default that hides data says so — the property any
  publisher-derived default has to have.

What is still missing at level 2 is the summary rung **below** `collapsed`: when
even one row of overlapping boxes is saturated, a feature track has nothing to
degrade to, where an alignments track has coverage. A per-bin count strip drawn
from the same fetch would be the feature-track equivalent, and would give the
density gate somewhere to send a region instead of a prompt. Not attempted;
noted because the gate's force-load prompt is the current answer and it is a
question rather than a picture.

### Honest floor & scoping

- A 100-sample MAF or a very deep pileup cannot be fit without losing detail, so
  level 3 (scroll) never fully disappears - but even there the right response is
  summarize-to-fit (level 2), with scroll as the genuine last resort.
- `useWheelScroll` is LGV-specific. Dotplot/synteny are genuinely 2D (vertical
  *is* a genome axis); none of the "vertical = document" logic applies there.
- Any grow / allocator change is gated on deployment context (embedded vs full
  app), because `TrackRenderingContainer` is shared.
- We lack data on which nesting users hit most; the allocator is a hypothesis.
  Cheapest de-risk: prototype the `allocations` computed behind an opt-in
  `viewHeight`, wire `trackHeight()` to it, and watch whether the async settling
  behaves before investing further.
