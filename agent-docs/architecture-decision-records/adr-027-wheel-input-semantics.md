---
status: Accepted
summary: "Wheel-input semantics stay per-handler — a unified resolver is relocation, not simplification"
---

# ADR-027: Wheel-input semantics stay per-handler — a unified resolver is relocation, not simplification

## Status

Accepted. Records the outcome of a "scrolls-within-scrolls is too complex" audit
prompted by the scroll-latching fix (`packages/core/src/util/scrollLatch.ts`,
[key_pattern_scroll_latch]). The mechanics of inner-panel scrolling were unified
in that change; this ADR is about the **dispatch** — deciding what a wheel event
*means* — and why it deliberately stays distributed.

## Context: a wheel event over an inner panel is handled twice

Inner displays paint to a `<canvas>` that sits inside the LGV container. A wheel
event therefore hits **two** bubble-phase listeners in order:

1. the panel's own canvas listener (pileup, variants matrix, or the canvas basic
   display's overflow container)
2. the view-level `wheelZoom.ts` controller on the LGV container, bound through
   `usePanZoom.ts` (zoom + horizontal pan)

`preventDefault()` doesn't stop propagation, so both run; the panel handler
suppresses the browser default and the view handler keys off `scrollZoom` to
decide zoom-vs-pan — and off `defaultPrevented`, which is how it knows the panel
already took this one. The composition is coherent — e.g. with `scrollZoom` ON, a
plain wheel over a pileup is skipped by the panel (so it falls through to the
view and zooms), while `shift`+wheel scrolls the pileup and the view bails via
its `shift && scrollZoom` escape hatch. The *complexity the user feels is real*:
two handlers per event, with `scrollZoom` mode flipping the meaning of the
gesture.

### The four handlers and their rules

| Handler | Concern | Wheel rule |
| --- | --- | --- |
| `wheelZoom.ts` (LGV) | zoom + horizontal genome pan | `defaultPrevented` → bail (a panel below consumed it). `shift && scrollZoom` → bail (page-scroll escape). `ctrl/meta` or (`scrollZoom && |dy|≥|dx|`) → zoom. else → horizontal pan via `deltaX`, **only when `|dx| > |dy|`**. |
| `usePanelVirtualScroll.ts` (pileup, canvas basic) | panel vertical scroll | skip if `(scrollZoom && !shift) || ctrl || meta`. else scroll inner (latched), **unless `|dx| > |dy|` and the latch is open**. → plain wheel scrolls when zoom OFF; needs `shift` when zoom ON. |
| `useRowVirtualScroll.ts` (both variant displays, MAF) | rows vertical scroll + row height | skip if `ctrl || meta`. `shift` → **change row height**. else if `!scrollZoom` → scroll inner (latched), under the same `|dx| > |dy|` exception. |

Each of those last two is **one rule across several call sites**, not one rule
per display, so each is written once in `packages/core/src/util/` and every
consumer supplies only its own viewport height plus `scrollZoom`. That is the
decision below applied, not an exception to it: unify where there is one true
rule.

### What each handler is bound to, and where it yields

The rules above say what a gesture *means*. Which element the listener sits on
is the other half, and it is where two of these handlers were wrong.

A handler binds to the **panel**: the element wrapping the canvas together with
the DOM overlays drawn over it. Not the `<canvas>` — a canvas takes no DOM
children, so a display's floating labels, group chips and arcs are its SIBLINGS,
and the ones that answer the pointer (they are clickable) are what a wheel over
them targets. Bound to the canvas, such a wheel reached no panel handler at all:
it left the track mid-gesture and the host page scrolled instead, worst in
embedded. `trackPointerPresence` keys off the same element and so failed the same
way, and worse — a label sliding under a *stationary* cursor is a `mouseleave` on
the canvas, which drops the latch and releases every remaining event in the
gesture to a page that has by then begun a scroll no `preventDefault` can take
back. MAF bound its rows container from the start and says why; the pileup and
the canvas basic display were corrected to match.

A panel that spans its overlays also covers a few that are controls rather than
content, so it **yields to `[data-gesture-owner]`** — JBrowse's existing marker,
the one the LGV's click-drag pan and MAF's drag-selection already test for. That
is what keeps the pileup's band resize handles and a floating legend behaving as
they did before the panel grew to cover them. Two things the marker deliberately
does not mean: an owner that IS the panel (`VerticalScrollbar` binds this handler
to its own marked track — the one control whose job is scrolling the panel), and
one ABOVE it (`TrackContainer` stamps the marker once for its whole overlay
layer, which would otherwise disown every wheel any display gets).

One consequence worth stating, since it is not obvious from the rules table: a
panel handler owns `preventDefault` but never `stopPropagation`, so an overlay
that wants a wheel entirely to itself has to stop propagation on its own — which
is what the scrollbar does, and why wheeling it never also zooms the view.

`preventDefault` is nonetheless what the view reads to stay out of a panel's
gesture. A trackpad's vertical swipe carries a small `deltaX` on every event, and
the view used to pan the genome sideways on it while the reads scrolled — two
axes moving for a one-axis gesture. The view now declines any wheel that arrives
already defaulted, which needs no new channel between the two handlers and no
timer: `createScrollLatch` keeps preventing for the whole continuous gesture,
over-scroll at the boundary included, and the pause that releases the latch is
exactly where the view should have the wheel back.

That alone would have traded the bug for its mirror image, because no panel
handler looked at which axis a gesture was on: a sideways swipe carrying two
pixels of vertical noise made the panel scroll two pixels, latch, and
`preventDefault` — so the pan the user meant died on the drift. **Each handler
therefore takes only the gesture whose dominant axis is its own**, ties going
vertical on both sides. The panels ask `latch.holds(e)` first, so a gesture they
have already latched keeps its sideways momentum instead of being cut in half
mid-scroll.

The view's half of that rule is not just the panels' mirror: it is what covers
the vertical scrolling **no handler reports**. The pinned-tracks block is a
native `overflow: auto` container inside the element the view binds to, so the
browser scrolls it and nothing is `preventDefault`ed — the axis test is the only
thing standing between that scroll and a genome drifting sideways under it, and
it costs no layout read in a handler that is not allowed to take one.

The canvas basic display used to be a third rule of its own (`useScrollSync.ts`:
a native overflow container, `shift` the only thing that scrolled it). It moved
to virtual scroll and adopted the pileup's rule exactly, which is what left two
rules rather than three — and left this table describing a file that no longer
exists, until an audit of the scroll system found the drift.

## The real inconsistency (not resolved here — it's a product call)

`shift`+wheel means two different things:

- pileup and canvas basic display → scroll the inner panel (while in zoom mode)
- both variant displays and MAF → **change row height**

A user who learns the gesture on one track is surprised on another. Converging
them is a UX decision with intentional history (the row-stack `shift`=row-height
is a deliberate zoom-like gesture on a coupled axis), so it is **not** changed
unilaterally. It is recorded here as known, decidable debt.

What is no longer part of it: plain wheel now scrolls every one of these panels
when `scrollZoom` is off, and `ctrl`/`meta` falls through to the browser and the
view on every one of them. The row-stack rule tested `shift` first and so
swallowed `ctrl+shift`+wheel — page zoom, dead over a MAF or variants track —
which was a bug rather than a per-display choice, and is fixed.

## Decision

Keep wheel-intent dispatch in each handler. Do **not** introduce a shared
`resolveWheelIntent(event, ctx) → {kind, amount}`.

The unify-the-dispatch instinct fails the codebase's own test (cognitive-load
reduction, not LOC; combining things that look similar is a trap). A resolver
genuinely simplifies only if all displays agree on one rule. They don't (table
above). A behavior-preserving resolver must therefore carry per-display branches —
it **relocates** the rules into one file with a `switch` and *adds* a layer
(now you read the generic resolver *and* still need to know which display you're
in). The resolver's payoff is **contingent on first making the product decision**
to unify the semantics; without that decision it is net-negative.

What *was* worth sharing — and already is — is the **mechanics**, where all
panels genuinely agree:

- `normalizeWheelDeltaY(deltaY, deltaMode, viewportHeight)` — wheel-unit → pixels
- `createScrollLatch().scroll(e, cur, delta, max)` — the boundary/latch/
  `preventDefault` contract for native scroll-chaining, in one tested place

That is the correct seam: unify where there's one true rule (delta units,
latching), keep distributed where the rule is a per-display product choice (what
the gesture *means*).

### What would justify revisiting

- A product decision to make `shift`+wheel mean the same thing on every display.
  Then a resolver expresses one rule and earns its keep — build it *after* the
  decision, not before.
- A third display family needing the same two-handler bubble composition, making
  the view↔panel handoff (not the per-panel rule) the duplicated part worth
  extracting.

## Consequences

- Future "why are there four wheel handlers / why is shift inconsistent" questions
  land here. The inconsistency is logged, not hidden.
- The root driver is the canvas/virtual-render architecture: painted panels have
  no native scroll container, so every affordance (delta normalization, scrollbar,
  latching, boundary chaining) is hand-rolled. This is the tax of virtualization,
  accepted for perf on large data — not accidental sprawl.
