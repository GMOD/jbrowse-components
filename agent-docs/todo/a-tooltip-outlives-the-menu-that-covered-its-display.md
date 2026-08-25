---
name: a-tooltip-outlives-the-menu-that-covered-its-display
description: the display is never sent a mouseleave when a portaled menu takes the pointer; decide whether the chrome exposes its clear or the menu calls it
metadata:
  area: display-kit, maf
  category: ready
---

# A tooltip outlives the menu that covered its display

Drag across a MAF track's rows, pick something from the menu that opens, and the
tooltip for the base the drag ended on stays drawn over the display — at that
pixel, unmoving, however far away the pointer goes.

The mechanism is not MAF's. `DisplayChromeBase` clears the tracked pointer on
the container's `onMouseLeave`, and the browser dispatches one by comparing the
pointer's old hover chain to its new one. `SubsequenceContextMenu` is a MUI menu
portaled to the body, so:

- the menu opens **at the release point with no mouse event**, which leaves the
  hover chain pointing at the display;
- the pointer then moves onto a menu item, and the chain becomes the portal's —
  the display is left, and it does get its `mouseleave` here;
- the item is **clicked and the menu unmounts**, so the chain's nodes are
  detached and Chrome moves hover to `body`;
- every later move transitions from `body`, and the display, which is not in
  either chain, is never told anything again.

`contextCoord` suppresses the tooltip while the menu is up
(`LinearMafDisplayComponent`'s `pointer && samples && !contextCoord`), so it
reappears on the frozen coordinate the moment the menu closes. Nothing clears
it but a move back onto the display and out again — which is what
`synteny/maf_row_synteny` does, in two `hover` steps with a comment, because a
poster carrying a stale tooltip over the payoff is what found this.

Every display with a menu of its own has the same shape; MAF is where it shows
because its tooltip is per-pixel and its menu opens from a drag.

**What is open is where the clear is called from.** `useMouseTracking` already
exports `handleMouseLeave` and `DisplayChromeBase` already calls it directly for
the case `mouseleave` cannot report (the container being *removed* rather than
left) — a menu closing over the display is a third case of the same kind. Either
`DisplayChrome` passes the clear down beside `mouseTracker` so a display calls
it when its own menu closes, or the chrome notices the unmount itself. The first
is smaller and puts the knowledge where it is; the second catches the displays
that have not thought about it.
