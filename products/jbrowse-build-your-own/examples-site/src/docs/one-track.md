`createViewState` gives you the engine: it resolves the assembly, picks an
adapter per file, fetches and parses in the background, and holds `bpPerPx`,
`offsetPx` and `displayedRegions`. It draws nothing. Two things turn it into a
picture:

1. **Tell it how wide it is.** Everything downstream is derived from the pixel
   width, so nothing renders until one has been measured. `useWidthSetter` from
   `@jbrowse/core/util/hooks` is the hook JBrowse's own views use for it: put
   the ref it returns on the element to measure.
2. **Mount a display.** Each track carries an `activeDisplay`, and every display
   exposes a `RenderingComponent`. Give it a box with a height and a positioning
   context and it draws.

The track below is a BigWig, so this is a real fetch through a real adapter,
laid out by the same code that runs in the full product. No header, no ruler and
no pan/zoom wiring — [Pan and zoom](../pan-and-zoom/#pan-and-zoom) adds those.
