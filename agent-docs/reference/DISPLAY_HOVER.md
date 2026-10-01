---
name: display-hover
description: Why a stored hover is a volatile the viewport can invalidate, which mixin clears it on which axes, and the `hoveredFeature` hook every display publishes it through. Read before storing a hit in a display or a view that owns a shared canvas.
kind: spec
---

# A stored hover is a volatile the viewport can invalidate

Most volatiles die with the view. A hover is the exception: the viewport can
make it wrong while it is still alive, and nothing tells the display.

## Four axes move the content, none of them a pointer event

Zoom, `offsetPx` (a side-scroll or locstring pan) and the display's own
`scrollTop` move content under a stationary cursor, and a sticky canvas gets no
`mousemove` / `mouseleave` for any of them. The fourth axis removes the content:
`regionTooLarge` replaces the subtree with the banner and Force load restores
it. The clear fires on both directions of that flip. Clearing on `bpPerPx` alone
leaves the other three axes naming what used to be there.

## Who installs the clear

`installClearHoverOnViewportChange` is a `reaction`, so its effect can read
hover state without a hover write re-firing it.

- **`MultiRegionDisplayMixin` installs it**, through
  `BaseDisplay.clearHoveredFeature`, the writing twin of `hoveredFeature`. It
  defaults to a no-op: a display that stores a hover overrides that one action.
- **`installGlobalFetchAutorun` installs it too.** A storer outside both
  foundations owes its own.
- **A view that owns a shared surface** uses `installClearHoverOnSurfaceMove`
  (`@jbrowse/core/util`): a `reaction` on the model that owns the surface over
  one value carrying every number that moves the picture, plus a `clear`
  callback (the owners store different things, so no duck-typed setter).
  Dotplot passes `plotTransform`, synteny's level `bandTransformKey`, and the
  breakpoint split view `overlayTransformKey`, which also carries each matched
  track's `scrollTop`, `height` and `regionTooLarge`.

## Deriving is the other correct design

MAF's tooltip stores no hit: its body re-runs `mafHitTest` from the live pointer
on every render. The row under the pointer is stored through `StoredHoverMixin`
and takes the same clear.

## Publish it as `hoveredFeature`

`hoveredFeature` is an overridable getter on `BaseDisplay`;
`LinearGenomeViewContainer` reads it off every display to feed
`session.hovered`. A cross-display consumer can only read a name the base
declares.

**A volatile cannot instantiate over a base computed**, so a display that stores
its hit stores it under another name and answers the hook with a getter over it.
`StoredHoverMixin<T>` (display-kit) is that trio, plus `setHoveredFeature` and
`clearHoveredFeature`, composed after `BaseDisplay`. When the chain hits the
`types.compose` ten-argument ceiling, nest a second `types.compose` inside the
outer one.

## Store or derive, never half

**Store** when the hit is expensive or several components read it, then answer
the clear: override `clearHoveredFeature` under `MultiRegionDisplayMixin`, or
install your own reaction elsewhere. **Derive** when the hit test is a lookup and
one component consumes it. Storing a hit and leaving the clear to the pointer
handlers is the one wrong choice, since they cover only the case where the
pointer moved.
