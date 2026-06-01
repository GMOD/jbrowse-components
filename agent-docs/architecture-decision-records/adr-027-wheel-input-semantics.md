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
2. the view-level `useWheelScroll.ts` on the LGV container (zoom + horizontal pan)

`preventDefault()` doesn't stop propagation, so both run; the panel handler
suppresses the browser default and the view handler keys off `scrollZoom` to
decide zoom-vs-pan. The composition is coherent — e.g. with `scrollZoom` ON, a
plain wheel over a pileup is skipped by the panel (so it falls through to the
view and zooms), while `shift`+wheel scrolls the pileup and the view bails via
its `shift && scrollZoom` escape hatch. The *complexity the user feels is real*:
two handlers per event, with `scrollZoom` mode flipping the meaning of the
gesture.

### The four handlers and their rules

| Handler | Concern | Wheel rule |
| --- | --- | --- |
| `useWheelScroll.ts` (LGV) | zoom + horizontal genome pan | `shift && scrollZoom` → bail (page-scroll escape). `ctrl/meta` or (`scrollZoom && |dy|≥|dx|`) → zoom. else → horizontal pan via `deltaX`. |
| `PileupComponent.tsx` | pileup vertical scroll | skip if `(scrollZoom && !shift) || ctrl || meta`. else scroll inner (latched). → plain wheel scrolls when zoom OFF; needs `shift` when zoom ON. |
| `useScrollSync.ts` (canvas basic) | overflow vertical scroll | skip if `!hasOverflow || ctrl || meta`. `shift` → scroll inner (latched). else `scrollZoom` → preventDefault. → **only `shift` scrolls inner.** |
| `useVariantVirtualScroll.ts` | matrix vertical scroll + row height | `shift` → **change row height**. else if `!scrollZoom && !ctrl && !meta && overflow` → scroll inner (latched). |

## The real inconsistency (not resolved here — it's a product call)

`shift`+wheel means three different things:

- pileup → scroll the inner panel (while in zoom mode)
- canvas basic display → scroll the inner panel (always)
- variants matrix → **change row height**

and plain wheel scrolls the pileup/variants panels but **not** the canvas basic
display (which needs `shift`). A user who learns the gesture on one track is
surprised on another. Converging these is a UX decision with possible intentional
history (variants' `shift`=row-height is a deliberate zoom-like gesture), so it is
**not** changed unilaterally. It is recorded here as known, decidable debt.

## Decision

Keep wheel-intent dispatch in each handler. Do **not** introduce a shared
`resolveWheelIntent(event, ctx) → {kind, amount}`.

The unify-the-dispatch instinct fails the codebase's own test (cognitive-load
reduction, not LOC; combining things that look similar is a trap). A resolver
genuinely simplifies only if all displays agree on one rule. They don't (table
above). A behavior-preserving resolver must therefore carry per-display branches —
it **relocates** three rules into one file with a `switch` and *adds* a layer
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
