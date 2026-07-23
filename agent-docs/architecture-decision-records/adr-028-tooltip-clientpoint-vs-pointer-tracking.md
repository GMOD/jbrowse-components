---
status: Accepted
summary: "Hover tooltips pass a controlled `clientPoint`; floating-ui pointer-tracking is opt-in"
---

# ADR-028: Hover tooltips pass a controlled `clientPoint`; floating-ui pointer-tracking is opt-in, not the default

## Status

Accepted. Records the root cause and fix of an "increasingly slower as the mouse
moves, with heap growth" report against the MAF display's hover tooltip
(`plugins/maf/src/LinearMafDisplay/components/MAFTooltip.tsx`), plus the general
rule it establishes for every `BaseTooltip` consumer.

## Context: `BaseTooltip` has two positioning modes, and the cheap one is not the default

`BaseTooltip` (`packages/core/src/ui/BaseTooltip.tsx`) positions its floating
element with floating-ui's `useClientPoint(context, clientPointCoords)`. That
hook has two distinct runtime behaviors depending on whether coordinates are
supplied:

- **Controlled** — caller passes `clientPoint={{x, y}}`. `useClientPoint` sets
  the position reference once per render in a layout effect and **adds no
  listeners**. The tooltip moves only because the caller re-renders it with new
  coordinates. This is what alignments, wiggle, canvas, gwas, hic, and the
  variant displays all do.

- **Pointer-tracking** — caller omits `clientPoint` (so `x`/`y` default to
  `null`). `useClientPoint` attaches a `window` `mousemove` listener whose
  handler calls `refs.setPositionReference(createVirtualElement(...))` —
  **allocating a fresh virtual-reference object on every mouse move** and kicking
  floating-ui's positioning state, which drives an additional render. This is the
  idiomatic floating-ui way to make a tooltip follow the cursor *without*
  threading coordinates down from the caller.

Neither mode is a bug in isolation. The trap is that **omitting the prop selects
the allocating mode silently** — there is no signal at the call site that a
heavier path was chosen.

## The failure: two per-move render drivers stacked on one tooltip

MAF was the only tooltip in the tree that rendered `<BaseTooltip>` with no
`clientPoint`. It is also unusual in that it *already* has a per-move re-render
driver: `useDragSelection` stores the live mouse position in React state and
updates it on every `mousemove` over the display (it powers the crosshairs and
the drag-select rectangle). So on MAF, every mouse move did **both**:

1. `useDragSelection` `setState` → re-render the tooltip subtree (the intended
   driver — the tooltip content is position-dependent), and
2. floating-ui's own `window` `mousemove` handler → allocate a virtual element +
   a second positioning state update.

The two compounded: redundant renders plus a per-move allocation the GC has to
chase. That is the "increasingly slower / memory grows while hovering" symptom,
and it is scoped to hover (the tooltip is unmounted otherwise), which matched the
report exactly — it was *not* the drag path.

Crucially, the heavy children under the MAF body
(`EmptyLinesOverlay`, `SummaryBarsOverlay`, `VisibleLabelsOverlay`, the coverage
canvas, `TreeSidebar`) are all `observer`-wrapped with stable props, so they
memo-skip when the body re-renders. The per-move cost was genuinely isolated to
the tooltip — which is why the fix is one prop, not a re-architecture.

## Decision

**A tooltip that already re-renders per mouse move passes a controlled
`clientPoint`.** MAF now threads client coordinates from `useDragSelection`
(`mouseClientX`/`mouseClientY`) through to `MAFTooltip`, which forwards them as
`clientPoint`. This removes the `window` listener and the per-move allocation;
positioning rides the re-render the component was doing anyway.

**Pointer-tracking mode stays a legitimate choice — for tooltips that do *not*
have their own per-move driver.** `SyntenyTooltip` and `ArcTooltip` render
`<BaseTooltip>` with no coordinates on purpose: they have no mouse coordinates to
pass and want cursor-follow for free. On them the single floating-ui listener is
the *only* per-move work, not a second copy of it, so it is the idiomatic and
correct mode. They are deliberately left unchanged — converting them would be
churn for a non-bug and would force callers to plumb coordinates they otherwise
never touch.

**`BaseTooltip` keeps its dual-mode contract.** Making `clientPoint` required (or
defaulting tracking off) would break the cursor-follow consumers, who rely on the
omit-the-prop behavior. The footgun is real but the surface that hits it is small
and now documented; a contract change is not worth breaking the working
consumers.

### Companion decision: per-move highlight is an overlay, not a redraw input

The same audit fixed `MafSequenceWidget`'s `SequenceCanvas`: the hovered-column
highlight was a dependency of the canvas draw effect, so moving one column over
re-ran the full rows×cols `fillText` grid just to tint a single column. The
highlight is now an absolutely-positioned overlay `<div>` in the scrolling
content layer (`SequenceDisplay`), and `hoveredCol` is gone from the canvas
entirely. General rule this encodes: **a per-move visual affordance (hover
highlight, crosshair, cursor band) belongs on a cheap overlay element, never wired
into the deps of an expensive full-surface redraw.**

## Consequences

- Future "why does `MAFTooltip` carry `clientX`/`clientY` when the others derive
  position from a single coord" questions land here. The answer: it has a second
  per-move driver to deduplicate against.
- New `BaseTooltip` consumers should default to passing `clientPoint`. Omit it
  **only** as a deliberate "follow the cursor, I have no coordinates to give"
  choice (the synteny/arc case) — and know that choice adds a `window` listener
  and a per-move allocation, which is fine precisely because nothing else is
  re-rendering the tooltip on those displays.
- The fix is two independent, self-contained changes (tooltip `clientPoint`;
  sequence-widget overlay), each verifiable or revertible alone. All 208
  `plugins/maf` tests stay green.

### What would justify revisiting

- A new tooltip consumer that both follows the cursor *and* re-renders per move
  (MAF's shape) appearing a third time — at which point a small
  `useFollowPointer()` helper that returns `{x, y}` for the controlled path could
  earn its keep, replacing both the omitted-prop mode and ad-hoc coordinate
  plumbing.
- floating-ui changing `useClientPoint` so the uncontrolled path no longer
  allocates per move, which would neutralize the cost difference and make the
  mode choice purely about who owns positioning.
