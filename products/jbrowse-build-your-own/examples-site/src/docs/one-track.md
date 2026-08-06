`createViewState` gives you the engine: it resolves the assembly, picks an
adapter per file, fetches and parses in the background, and holds `bpPerPx`,
`offsetPx` and `displayedRegions`. It draws nothing. Two things turn it into a
picture:

1. **Tell it how wide it is.** Everything downstream is derived from the pixel
   width, so nothing renders until one has been measured. `useWidthSetter` from
   `@jbrowse/core/util/hooks` is the hook JBrowse's own views use for it: put
   the ref it returns on the element to measure.
2. **Mount a display**, once `view.ready` says there is something to draw. Each
   track carries an `activeDisplay`, and every display exposes a
   `RenderingComponent`. Give it a box with a height and a positioning context
   and it draws.

`view.ready` rather than `view.initialized`, and the difference has cost people
an afternoon: `initialized` answers "have the assembly's regions loaded", which
is only the first of two async steps. Navigating then populates
`displayedRegions`, and in the window between the two `initialized` is already
true while there is still nothing on screen — so a display mounted there runs
its block reads against no regions. `ready` folds in that gap and a failed
assembly load, and it is the gate anything of yours that reads block geometry
needs too.

The track above is a BigWig, so this is a real fetch through a real adapter,
laid out by the same code that runs in the full product. No header, no ruler and
no pan/zoom wiring — [Pan and zoom](../pan-and-zoom/#pan-and-zoom) adds those.
