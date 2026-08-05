`view.horizontalScroll(deltaPx)` pans and `view.zoomTo(bpPerPx, offsetPx)` zooms
about a pixel. The view owns the maths — it clamps to the ends of the assembly
and to its own zoom limits, and `zoomTo` keeps the base under the cursor put —
so neither needs a range check. Translating events into those two calls is the
whole example.

## The wheel listener cannot go on the element as a prop

React registers `wheel` at the root as a **passive** listener, so a handler
installed through `onWheel` cannot call `preventDefault` — the gesture drives
the host page's scroll at the same time as the view.
`addEventListener('wheel', handler, { passive: false })` on the element is the
only way to claim it, which is what JBrowse's own `createWheelZoomController`
does.

Deltas arrive in pixels, lines or pages depending on the browser and the
pointing device. `normalizeWheelDelta` from `@jbrowse/core/util/wheelZoom` makes
a notch of a Firefox wheel move the view as far as a notch of a Chrome one.

## What a bare wheel means is a session preference

`view.scrollZoom` decides it, and the checkbox in the demo writes it. On, the
wheel zooms the way a map does — the right default when the browser owns its
area of the page. Off, the wheel scrolls the page and only ctrl/cmd+wheel zooms
— the right default when the browser is one element in a long document.

Read it off the view rather than keeping your own copy. Displays that scroll
vertically inside themselves — an alignments pileup first of all — consult the
same `view.scrollZoom` to work out whether the plain wheel is already spoken
for, so a private `useState` that disagrees gets you both behaviours at once:
the pileup scrolls its reads and the view zooms under the cursor. That is also
why the handler here leaves shift+wheel alone while scroll-to-zoom is on.

## Capture the pointer on move, not on press

`setPointerCapture` is what keeps a drag panning when the cursor leaves the
container. Taking it on `pointerdown` is the obvious place and it is wrong:
capture retargets the whole rest of the gesture — including the `click` that
ends it — at the capturing element, so every display's click-to-select-a-feature
stops working while the page still renders perfectly. So a press only becomes a
drag after the pointer has travelled a few pixels, and only then captures.

Presses that were never yours are the other half. JBrowse marks the parts that
drag on their own — a vertical scrollbar, a resize handle — with
`data-gesture-owner`. Test for those and for `button` before starting a pan,
with `closest`, because the press usually lands on an icon inside the control.
