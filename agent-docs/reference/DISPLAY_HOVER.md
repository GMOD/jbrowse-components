---
name: display-hover
description: Why a stored hover is a volatile the viewport can invalidate, which mixin clears it on which axes, and the `hoveredFeature` hook every display publishes it through. Read before storing a hit in a display or a view that owns a shared canvas.
---

# A stored hover is a volatile the viewport can invalidate

Most volatiles die with the view and need no more thought than that. A hover is
the exception: a third party — the viewport — can make it wrong while it is
still alive, and nothing tells the display.

## Four axes move the content, none of them a pointer event

Zoom, `offsetPx` (a side-scroll or a locstring pan) and the display's own
`scrollTop` all move content under a stationary cursor, and a sticky canvas gets
no `mousemove` / `mouseleave` for any of them — so a hover held in a volatile
goes on naming what *used* to be there. Clearing on `bpPerPx` alone is the same
bug with two axes left in it, which is where alignments started.

The fourth axis *removes* the content: `regionTooLarge` replaces the subtree
with the banner and Force load brings it back, where a highlight box positioned
from the layout draws with no pointer near it. The clear fires on both
directions of that flip. It was a separate hook only alignments overrode, while
five other displays store a hover and reach the same banner.

## Who installs the clear

`installClearHoverOnViewportChange` is a `reaction` precisely so its effect can
read hover state without setting a hover re-firing it.

**`MultiRegionDisplayMixin` installs it, so a per-region display does not.** It
clears through `BaseDisplay.clearHoveredFeature` — the writing twin of
`hoveredFeature`, defaulting to a no-op — so a display that stores a hover
overrides one action and a display that derives one does nothing. Six displays
used to pass their own closure to the installer, which is six chances to omit
the call, and omitting it is invisible until someone pans.

**`installGlobalFetchAutorun` installs it too, and nothing else does, so a
storer outside both foundations owes its own.** Three
views store a hover over a surface of their own and each had to answer this
separately, which is what makes it a rule rather than one mixin's habit. The
answer is `installClearHoverOnSurfaceMove` (`@jbrowse/core/util`): a `reaction`
on the *model that owns the surface* — the view or level, since one action fans
a hit out across every display drawing on it — over one value carrying every
number that moves the picture, plus the `clear` that drops the hit. Dotplot
passes `plotTransform`; synteny's level passes `bandTransformKey`, each row's
`offsetPx` and `bpPerPx`, and the band height. Both leave out the two axes a
shared canvas does not have: no per-display scroll, no too-large banner.

The breakpoint split view is the third, and its surface is an SVG rather than a
canvas: one overlay spanning every stacked row, so the *view* holds the hovered
curve and `overlayTransformKey` carries both rows' `offsetPx`/`bpPerPx` and —
unlike the comparative pair — each matched track's `scrollTop`, `height` and
`regionTooLarge`, because the rows it draws over are ordinary LGV panels that
scroll, resize and hit the banner. It reached the rule late: the hover was React
state per overlay track with a `window` wheel listener for a clear, which caught
the one axis its author had in hand and left a header zoom, a locstring search,
a pileup scroll and the banner naming a junction the cursor had left.

`clear` is a callback rather than a duck-typed `setHoveredFeature`, because the
three owners store three different things — a synteny pick hit, a dotplot
feature index, an overlay curve id. The omission the per-display installer
guards against cannot happen here: a surface owner writes the call itself.

Synteny is what the rule cost before anyone wrote it down. Its stored hit had
one clear outside the pointer handlers — a fetch commit — and its fetch key is
snapped and zoom-bucketed, so a pan inside the buffer left the tooltip open at
the cursor naming the ribbon that used to be there. A wheel over that canvas
zooms both rows while suppressing the hover handler, so the commonest way to
move the picture fired no pointer event at all.

So: answer the invalidation question once, in the place that owns the hover.

## Deriving is the other correct design

MAF stores no hit — its body re-runs `mafHitTest` from the live pointer on every
render, so an observer re-resolves under a moving viewport by construction.

## Whichever it is, publish it as `hoveredFeature`

`hoveredFeature` is an overridable getter on `BaseDisplay` (default
`undefined`), and `LinearGenomeViewContainer` reads it off every display of
every track to feed `session.hovered`, the view-wide "what is the user pointing
at" channel. It is a hook for the reason `FetchMixin.fetchInert` is
one: a cross-display consumer can only read a name the base declares. The
container used to read `featureUnderMouse`, which only the wiggle, alignments
and Manhattan families spelled that way — canvas said `hoveredFeature`, variants
`hoveredGenotype` — so the channel carried a hover from a third of the display
types and nothing said which.

One MST constraint shapes the fill: **a volatile cannot instantiate over a base
computed**, so a display that *stores* its hit stores it under another name and
answers the hook with a getter over it. `StoredHoverMixin<T>` (display-kit) is
that trio — the volatile, the getter, `setHoveredFeature`, `clearHoveredFeature`
— composed after `BaseDisplay` by the wiggle, Manhattan, multi-sample variant
and multi-row feature displays. The last of those sat past the ten-argument
`types.compose` ceiling and reached the mixin by nesting a second
`types.compose` inside the outer one, which is the shape to reach for when
another chain hits the same limit.

## Two correct answers and one wrong one

**Store** when the hit is expensive or several components read it (canvas,
alignments, Manhattan, wiggle, the multi-row painting, the multi-sample variant
matrix) — then answer the clear: override `clearHoveredFeature` under
`MultiRegionDisplayMixin`, or install your own reaction anywhere else.
**Derive** when the hit test is a lookup and one component consumes it. What is
not allowed is the third thing: storing it and leaving the clear to the pointer
handlers, which cover only the case where the pointer is what moved.
