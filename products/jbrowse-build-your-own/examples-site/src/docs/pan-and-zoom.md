Moving around is what makes it a genome browser rather than a picture of a
locus. The view already owns all of the maths: it clamps to the ends of the
assembly and to its own zoom limits, and `zoomTo` keeps a chosen pixel anchored
so the base under the cursor stays put. What is left for you is translating
events into calls, and the example below is the whole of it.

`view.horizontalScroll(deltaPx)` pans. `view.zoomTo(bpPerPx, offsetPx)` zooms
about a pixel. Neither needs a range check.

## The wheel listener cannot go on the element as a prop

React registers `wheel` at the root as a **passive** listener, so a handler
installed through `onWheel` is not allowed to call `preventDefault`. Wire it up
that way and the gesture drives the host page's scroll at the same time as it
drives the view — the reader wheels to zoom in and the whole article slides away
underneath.

`addEventListener('wheel', handler, { passive: false })` on the element is the
only way to claim it. JBrowse's own view does the same thing, in
`createWheelZoomController`.

The deltas themselves arrive in pixels, lines or pages depending on the browser
and the pointing device. `normalizeWheelDelta` from
`@jbrowse/core/util/wheelZoom` is what makes a notch of a Firefox wheel move the
view as far as a notch of a Chrome one.

## What a bare wheel means is a session preference

`view.scrollZoom` decides it, and the checkbox in the demo writes it:

- **On** — the wheel zooms, the way a map does. The right default when the
  browser owns its area of the page.
- **Off** — the wheel scrolls the page and only ctrl/cmd+wheel zooms. The right
  default when the browser is one element in a long document, where a wheel that
  silently swallowed the page scroll would trap the reader.

Read it off the view rather than keeping your own copy. Some displays scroll
vertically inside themselves — an alignments pileup is the one you will hit
first — and their own wheel handler consults the same `view.scrollZoom` to work
out whether the plain wheel is already spoken for. A private `useState` that
disagrees with the session gets you both behaviours at once: the pileup scrolls
its reads _and_ the view zooms under the cursor. That handoff is also why the
handler leaves shift+wheel alone while scroll-to-zoom is on, and why it falls
through to the pan branch when it is off. JBrowse's own view draws the line in
the same place.

The ctrl mode has a well-known failure: the user wheels, nothing moves, and
nothing says why. The prompt in the demo is the fix Google Maps uses — say so,
on the element, at the moment it happens. It is a label rather than a shield: it
takes no pointer events, because the wheel that summoned it is still
legitimately scrolling the page.

## Capture the pointer on move, not on press

A drag has to keep panning when the cursor leaves the container and end even if
the button comes up outside the window, which is what `setPointerCapture` is
for. Taking it on `pointerdown` is the obvious place and it is wrong: capture
retargets the whole rest of the gesture — including the `click` that ends it —
at the capturing element, so nothing underneath ever sees a click again. Every
display's click-to-select-a-feature stops working, and the page still renders
perfectly, which is what makes it hard to notice.

So the press only becomes a drag after the pointer has travelled a few pixels,
and only then does it capture. A press that never moves never captures and stays
the click it looked like.

The other half is presses that were never yours. A display draws controls in its
own corner, and JBrowse marks the parts that drag on their own — a vertical
scrollbar, a resize handle — with `data-gesture-owner`. Test for those and for
`button` before starting a pan, with `closest`, because the press usually lands
on an icon inside the control. `stopPropagation` from the control's side would
not do: both handlers want the same pointer events.

## Where to stop

Touch, keyboard navigation and a rubberband region select are all things
JBrowse's own view has and this handler does not. The
[next page](../one-track/#one-track) takes even this back out, to show the floor
underneath it.
