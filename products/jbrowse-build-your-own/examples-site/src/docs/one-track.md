`createViewState` gives you the engine: it resolves the assembly, picks an
adapter per file, fetches and parses in the background, and holds `bpPerPx`,
`offsetPx` and `displayedRegions`. It draws nothing. Three things turn it into a
picture:

1. Tell it how wide it is. Everything downstream derives from pixel width.
   `useWidthSetter` from `@jbrowse/core/util/hooks` hands back a ref to put on
   the element to measure.
2. Mount a display once `view.status.type` is `'ready'`. Every track carries an
   `activeDisplay` exposing a `RenderingComponent`. Give it a box with a height
   and a positioning context.
3. Tell it which colours to draw with. `SessionPaletteProvider` takes the
   session and your own light/dark state; skip it and the parts a display draws
   in React — here, the y-axis — stay on JBrowse's light default on a dark page.

**`view.status`, not `view.initialized`.** `initialized` covers only the first
of two async steps, loading the assembly's regions. Navigating then populates
`displayedRegions`. Between them `initialized` is true with nothing on screen,
and a display mounted there reads blocks against no regions. `status` folds both
steps in and names the two failure outcomes `initialized` says nothing about —
see [Loading and error states](../loading-and-errors/).
