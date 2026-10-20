---
name: display-hover
description: Why a stored hover goes stale under a still cursor and what clears it, the derived `PointerHoverMixin` that needs no clear, and the `hoveredFeature` hook every display publishes through. Read before storing a hit in a display or a view that owns a shared canvas.
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

`PointerHoverMixin<T>` (display-kit) stores the pointer's position, and its
`hoveredFeature` is the display's `hoverHitAt` at that position, a computed that
`sameHit` holds to one value per hit. A zoom, pan, scroll, reorder or fetch
re-resolves it, so no reaction clears it on the viewport's axes and
`clearHoveredFeature` stays `BaseDisplay`'s no-op. Multirow and HiC use it.

- **The chrome owns the pointer.** Pass `model.setPointer` as the chrome's
  `onPointerPosition`. The chrome reports `undefined` when the pointer leaves,
  a banner replaces the container, or a `ContextMenu` opens or closes.
- **Put a gate in `hoverHitAt`.** A global display answers no hit while
  `isLoadingOrCanceled`, and its override says so.

MAF's tooltip stores no hit either: its body re-runs `mafHitTest` from the live
pointer on every render. The row under the pointer is stored through
`StoredHoverMixin` and takes the clear.

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

**Derive** through `PointerHoverMixin` when the hit test is cheap enough to re-run
on every change it reads, which a lookup is. **Store** when it is not (the
pileup's), then answer the clear: override `clearHoveredFeature` under
`MultiRegionDisplayMixin`, or install your own reaction elsewhere. Storing a hit
and leaving the clear to the pointer handlers is the one wrong choice, since
they cover only the case where the pointer moved.
