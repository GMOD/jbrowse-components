`view.horizontalScroll(deltaPx)` pans and `view.zoomTo(bpPerPx, offsetPx)` zooms
about a pixel. The view owns the maths — it clamps to the ends of the assembly
and to its own zoom limits, and `zoomTo` keeps the base under the cursor put.

Turning events into those two calls is `usePanZoom`, from
`@jbrowse/core/util/usePanZoom`. It is the gesture layer JBrowse's own view
runs, so a browser you assemble here feels like the one you didn't:

```tsx
const ref = useWidthSetter(view)
const { containerProps, showZoomHint } = usePanZoom(ref, view)
```

Spread `containerProps` on the element you measured, and give it
`touchAction: 'none'` — your half of the deal, without which the browser claims
a touch-drag as a page scroll and the pointer stream never arrives.

## What a bare wheel means is a session preference

`view.scrollZoom` decides it, and the checkbox in the demo writes it. On, the
wheel zooms the way a map does — right when the browser owns its area of the
page. Off, the wheel scrolls the page and only ctrl/cmd+wheel zooms — right when
the browser is one element in a long document.

Read it off the view rather than keeping your own copy. Displays that scroll
vertically inside themselves — an alignments pileup first of all — consult the
same flag to work out whether the plain wheel is already spoken for, so a
private `useState` that disagrees gets you both behaviours at once: the pileup
scrolls its reads and the view zooms under the cursor.

That mode has a well-known failure — the user wheels, nothing moves, and there
is no way to find out why. `showZoomHint` is raised for exactly that gesture and
clears itself; the prompt in the demo is drawn from it.

## What the hook is getting right

- A handler installed through React's `onWheel` prop **cannot**
  `preventDefault`: React registers `wheel` at the root as a passive listener,
  so the page scrolls while the view zooms.
- Deltas arrive in pixels, lines or pages by browser and device, several per
  frame, and an inertial flick crosses decades of scale without a rate limit.
- Trackpads emit a stray sideways delta mid-pinch, panning the view out from
  under the zoom.
- Pointer capture retargets the `click` that ends a gesture, so taking it on
  `pointerdown` stops every display's click-to-select-a-feature. A press becomes
  a drag after a few pixels, and captures then.
- Presses that were never yours: JBrowse marks the parts that drag on their own
  — a vertical scrollbar, a resize handle — with `data-gesture-owner`, and those,
  buttons and shift-presses are left to them.

`createWheelZoomController` is the primitive underneath, for a different gesture
set.
