---
name: hover-clear-on-track-reflow
description: The fifth axis `installClearHoverOnViewportChange` doesn't watch — a track above changing height slides a display's box under a stationary cursor — why `view.trackHeights` is the tempting term and why wiring it in trades a self-healing staleness for a flicker.
---

# Clearing a hover when the track above reflows

`installClearHoverOnViewportChange` drops a display's hovered feature on four
axes: `bpPerPx`, `offsetPx`, the display's own `scrollTop`, and
`regionTooLarge`. Three move the content, one removes it. All four are model
state on the view or the display, which is what lets the whole thing be one
`reaction` per display.

There is a fifth way the content moves and it is not in there: **the display's
own box moving down the page.** A track above it grows — an alignments display
fitting its pileup as reads arrive, a track shown or hidden, someone dragging a
resize handle — and every display below slides by that delta while the cursor
stays where it is. No pointer event fires, because the pointer did not move and
a sticky canvas has no element travelling with its features. The stored hover
then names a feature that is no longer under the cursor.

This is the same shape as the dotplot bug that put `viewHeight` into
`plotTransform` (`setupClearHoverOnPlotMove`), and it stayed unfixed here for a
different reason than it was missed there.

## Why it isn't simply wired up

The model does hold a usable term: `LinearGenomeView.trackHeights`, the sum of
every track's height. Any reflow changes it, so a reaction keying on it catches
every case.

It catches too much. That sum moves when a track **below** the hovered one grows,
which moves nothing the cursor is over, and it moves once per frame while a
grow-to-fit display settles. So hovering a gene on track 1 while an alignments
track further down fills in would blink the tooltip out several times a second —
trading a staleness that fixes itself on the next mouse move for a flicker
during exactly the moments a user is watching data land.

The precise term is the sum of the heights **above** this display, which each
display can compute from its index in `view.tracks`. That is correct and it is
O(tracks) per display per reflow, i.e. O(tracks²) for a reflow that moves
everything — fine at real track counts, but it also makes every display's hover
reaction depend on every earlier track's height, which is a much wider
dependency graph than the four axes it joins.

## What would settle it

A DOM-level answer sidesteps the choice: one `ResizeObserver` on the track
container, or an observer on each display's own box, clearing the hover when the
box's top moves. That measures the thing that actually matters rather than a
model proxy for it, and it costs one observer rather than a term in N reactions.
It is a bigger change than a fifth axis — the hover-clear is currently pure
model state with no DOM in it at all, and that is worth something.

## Why it may not be worth any of them

The failure self-heals on the very next `mousemove`, and the highlight box
travels with the canvas, so nothing on screen looks wrong — only the tooltip's
text is stale, and only until the pointer twitches. Nobody has reported it. The
dotplot case was worse (its tooltip is anchored to the pointer while the
restroke is anchored to the plot, so the two visibly separate) and its fix was
free, because `viewHeight` was already an input to the projection everything
else read.

Read this before adding the fifth axis; the argument against is the interesting
half.
