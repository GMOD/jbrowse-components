`createViewState` gives you the engine: it resolves the assembly, picks an
adapter per file, fetches and parses in the background, and holds `bpPerPx`,
`offsetPx` and `displayedRegions`. It draws nothing. Two things turn it into a
picture:

1. **Tell it how wide it is.** Everything downstream derives from pixel width,
   so nothing renders until one is measured. `useWidthSetter` from
   `@jbrowse/core/util/hooks` is the hook JBrowse's own views use — put the ref
   it returns on the element to measure.
2. **Mount a display** once `view.ready` says there is something to draw. Every
   track carries an `activeDisplay` exposing a `RenderingComponent`; give it a
   box with a height and a positioning context.

**`view.ready`, not `view.initialized`** — the difference has cost people an
afternoon. `initialized` answers "have the assembly's regions loaded", the first
of two async steps; navigating then populates `displayedRegions`, and in the
window between them `initialized` is already true with nothing on screen, so a
display mounted there runs its block reads against no regions. `ready` folds in
that gap and a failed assembly load, and it is the gate anything of yours that
reads block geometry needs too.

The track is a BigWig, so this is a real fetch through a real adapter, laid out
by the same code that runs in the full product.
[Pan and zoom](../pan-and-zoom/#pan-and-zoom) adds the gestures.
