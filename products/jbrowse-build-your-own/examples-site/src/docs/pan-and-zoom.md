`view.horizontalScroll(deltaPx)` pans and `view.zoomTo(bpPerPx, offsetPx)` zooms
about a pixel. The view clamps to the assembly's ends and keeps the base under
the cursor put. `usePanZoom` from `@jbrowse/core/util/usePanZoom` (the gesture
layer JBrowse's own view runs) turns events into those two calls:

```tsx
const ref = useWidthSetter(view)
const { containerProps, showZoomHint } = usePanZoom(ref, view)
```

Spread `containerProps` on the element you measured. `touch-action: none` comes
with the hook, written onto that element — without it the browser claims a
touch-drag as a page scroll and the pointer stream never arrives, on a phone
only. Name `touchAction` in your own `style` to override it, or pass the hook a
`touchAction` of `'pan-y'` when the view sits in a long document that should
still scroll.

## A bare wheel is a session preference

`view.scrollZoom` decides it: on, the wheel zooms the way a map does. Off, it
scrolls the page and only ctrl/cmd+wheel zooms, and `showZoomHint` says so when
someone wheels and nothing moves. **Read it off the view rather than keeping
your own copy**: displays that scroll vertically inside themselves consult the
same flag to see whether the plain wheel is spoken for, so a private copy that
disagrees gets you both at once.

## What the hook handles

- React registers `wheel` as passive at the root, so a handler installed through
  `onWheel` cannot `preventDefault`.
- Deltas arrive in pixels, lines or pages by device, and an inertial flick
  crosses decades of scale unless rate-limited.
- Pointer capture retargets the `click` that ends a gesture, so taking it on
  `pointerdown` kills click-to-select-a-feature.
- Buttons, shift-presses and `data-gesture-owner` elements are left alone.
