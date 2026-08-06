---
status: Accepted
summary: "Track paint containment stays; display chrome escapes the inter-region masks by portal, because the stacking context that blocks a z-index is the same thing that isolates the paint"
---

# ADR-058: Track paint containment stays — the portal is what it costs

## Status

Accepted (2026-08). Measured, and the measurement is re-runnable:
`products/jbrowse-web/browser-tests/probe-containment.ts`.

Related: [ADR-026](adr-026-displaychrome-layering-stays.md) (the chrome's
layering), [DISPLAYCHROME.md](../reference/DISPLAYCHROME.md).

## Context

`TrackRenderingContainer` seals each display's DOM in `contain: strict`. The
LGV then draws `PaddingBlocks` — the elided, boundary and region-separator masks
— as a **later sibling** of that box, so they paint over the display. That is
deliberate: regions are laid out contiguously, so a separator has to cover track
data on both sides of the seam rather than sit in a gap.

The consequence is that nothing inside a display can paint above those masks.
Containment creates a stacking context, and a stacking context is atomic: a
descendant's `z-index` orders it against its siblings *inside* the context, never
against a sibling of the context itself. So every piece of display chrome that
must stay legible at whole-genome or multi-region scale reaches the
TrackContainer's overlay layer through `TrackOverlayPortal` instead — the
multi-wiggle legend, the tree sidebar and its row labels, hic's overlay panel,
the bottom-right status chips, and (as of this ADR) the shared status overlays.

That list keeps growing, and each new portal reads as accumulated workaround. The
question this ADR settles is whether the containment causing them is worth
keeping.

## Decision

**Keep `contain: strict`. Portal the chrome.** The two are not independent
choices — see the measurement.

Concretely:

- Display chrome that must clear the masks is wrapped in `TrackOverlayPortal`,
  which lands it in the TrackContainer's `zIndex: 100` overlay node (above the
  masks, below `TrackLabel` at 200) and falls back to rendering in place outside
  a TrackContainer.
- The **shared status overlays portal once, as a group**, in
  `DisplayStatusChromeBase` — not per overlay, and not in an overlay set. That
  level is the one both the MUI set and `plainChromeOverlays` pass through, so a
  replacement set can't silently keep the bug (the two have drifted before).
  `children` — the canvas — stays behind, because the masks are supposed to
  cover it.
- The overlay layer is `pointer-events: none`, so any interactive overlay sets
  `pointer-events: auto` on its own positioned box. Stated in
  `chromeOverlays.ts` as part of the overlay-set contract, since a set that
  misses it loses its retry/cancel button with no other symptom.

## Evidence

One page, one build, one 18-track session; the only thing that changes between
arms is an injected stylesheet flipped between traced batches, arms rotated so
warm-up is shared. Metric is `devtools.timeline` event counts and summed
durations; ratios of medians over 5 interleaved reps.

On the real DOM every arm ties (±6%) — canvas displays hold ~20 nodes each, so
containment has nothing to skip. Under `HEAVY=300` (300 nodes injected per
track, standing in for the DOM-heavy displays that do exist — tree-sidebar row
labels, legends), `paintMs` as a ratio to `contain: strict`:

| scenario | `overflow: clip` | `contain: layout style` | `contain: paint` |
| --- | --- | --- | --- |
| zoom | **3.6x – 4.6x** | 0.94x | 0.93x |
| pan | **4.0x – 4.8x** | 0.99x – 1.49x | 1.00x – 1.43x |
| track height change | **2.4x – 2.6x** | 0.98x | 0.97x |
| viewport resize | 0.98x – 1.11x | 0.99x – 1.59x | 0.99x – 1.11x |

Ranges span five runs, headless and headed (`ANGLE Mesa Intel UHD 630`) — a
hardware rasterizer does not rescue the `clip` arm; zoom got worse on it. Paint
**counts** are identical across arms in every scenario; only the time per paint
moves, i.e. the invalidated area grows past the track. Layout and style recalc
never move.

**The finding is sharper than "containment is faster."** `contain: layout style`
ties with `strict` despite having no paint containment. What the winning arms
share is that they *create a stacking context*; `overflow: clip` is the only arm
that doesn't. So the stacking context **is** the paint isolation. "Let chrome
use a z-index instead of a portal" and "keep the paint isolation" are one knob in
two positions, and a portal is the only way to have both.

Viewport resize is the lone flat row, and consistently so: there the whole
document relayouts and repaints regardless, leaving per-track isolation little to
save. Every gesture that moves content *within* a stable layout — the ones users
spend their time in — pays.

## Rejected alternatives

### Swap `contain: strict` for `overflow: clip`

The tempting one, because `clip` clips without creating a scroll container (so
the spurious-scrollbar bug that motivated dropping `overflow: hidden` doesn't
apply) **and** without creating a stacking context, which would let all seven
portal sites become plain z-indexes. Rejected on the numbers above: 2.4-4.8x
paint time on zoom, pan and track resize.

### Narrow `contain: strict` to `contain: paint`

Measured free (0.93x - 1.43x, ties within noise). It also wins nothing, and it
still creates a stacking context, so it would not remove a single portal. Not
worth the churn.

### Invert control: displays declare chrome, TrackContainer renders it

The portal's honest alternative — chrome as a prop or slot, placed by the
TrackContainer in its overlay layer, no `createPortal` anywhere. It threads new
props through 15 displays and two external packages (`tree-sidebar`, hic) to
reach the same DOM outcome. `createPortal` is React's own mechanism for exactly
this ("render here, live in that layer"); the inversion is the same design
spelled with more plumbing.

### Portal each status overlay individually

The first shape of this change, and it made the portal count worse rather than
better — a wrapper in `DisplayLoadingOverlay` plus a matching one in
`plainChromeOverlays`, i.e. two places to keep in step for one behavior, which is
precisely how those two sets drifted before. Hoisted to the level they share.

## Consequences

- The growing number of `TrackOverlayPortal` call sites is a **cost of a
  measured decision**, not drift. Don't tidy it away; the comment on
  `trackRenderingContainer` and the one on `TrackOverlayPortal` both point here.
- A display's chrome cannot be raised above the masks by styling alone. New
  floating chrome uses the portal, or accepts being striped at multi-region
  scale.
- Interactive overlays own their `pointer-events: auto`. There is no place to
  default it, because the value has to live on the positioned element itself.
- The containment is nearly free *today* (real-DOM arms all tie) and becomes
  load-bearing exactly as displays grow DOM. It should be re-measured, not
  re-argued, if that changes: `HEAVY=300 REPS=5 node
  --experimental-strip-types products/jbrowse-web/browser-tests/probe-containment.ts`,
  with `HEADLESS=0` for the hardware path.
