`view.horizontalScroll(deltaPx)` pans and `view.zoomTo(bpPerPx, offsetPx)` zooms
about a pixel. The view owns the maths — it clamps to the assembly's ends and
its own zoom limits, and keeps the base under the cursor put.

Turning events into those two calls is `usePanZoom` from
`@jbrowse/core/util/usePanZoom` — the gesture layer JBrowse's own view runs:

```tsx
const ref = useWidthSetter(view)
const { containerProps, showZoomHint } = usePanZoom(ref, view)
```

Spread `containerProps` on the element you measured and give it
`touchAction: 'none'` — your half of the deal, without which the browser claims
a touch-drag as a page scroll and the pointer stream never arrives.

## A bare wheel is a session preference

`view.scrollZoom` decides it. On, the wheel zooms the way a map does. Off, the
wheel scrolls the page and only ctrl/cmd+wheel zooms — right when the browser is
one element in a long document.

**Read it off the view rather than keeping your own copy.** Displays that scroll
vertically inside themselves consult the same flag to work out whether the plain
wheel is spoken for, so a private `useState` that disagrees gets you both
behaviours at once. `showZoomHint` covers that mode's known failure: the user
wheels, nothing moves, no way to find out why.

## What the hook gets right

- A handler installed through React's `onWheel` **cannot** `preventDefault`:
  React registers `wheel` at the root as passive, so the page scrolls while the
  view zooms.
- Deltas arrive in pixels, lines or pages by browser and device, several per
  frame, and an inertial flick crosses decades of scale unless rate-limited.
- Trackpads emit a stray sideways delta mid-pinch, panning out from under the
  zoom.
- Pointer capture retargets the `click` that ends a gesture, so taking it on
  `pointerdown` kills click-to-select-a-feature.
- Scrollbars and resize handles carry `data-gesture-owner`, and those, buttons
  and shift-presses are left alone.
