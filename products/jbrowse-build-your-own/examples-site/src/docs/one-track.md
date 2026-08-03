A genome browser is two halves. The **engine** resolves an assembly, picks an
adapter for each file, fetches and parses in the background, and keeps the
coordinate state. The **chrome** is everything you see around the data. JBrowse
ships both, welded together as `@jbrowse/react-linear-genome-view2`. These pages
take the weld out.

`createViewState` gives you the engine and hands back a view model. It knows
`bpPerPx`, `offsetPx` and `displayedRegions`, and it draws nothing at all. Two
things turn it into a picture:

1. **Tell it how wide it is.** Everything downstream is derived from the pixel
   width, so nothing renders until a `ResizeObserver` has reported one.
2. **Mount a display.** Each track carries an `activeDisplay`, and every display
   exposes a `RenderingComponent`. Give it a box with a height and a positioning
   context and it draws.

That is the whole of the example below. The track is a BigWig, so what you are
looking at is a real fetch through a real adapter, laid out by the same code
that runs in the full product.

The previous page, Pan and zoom, builds this same view and wires wheel and
pointer events into it. This page leaves those out, to show the floor: a
measured div and one track, nothing else.
