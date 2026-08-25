A BigWig, a Tabix'd GFF3 and a CRAM in one column. Every track exposes a
`RenderingComponent`, so the mounting code doesn't know which is which and a
fourth track is one more string in a list of ids.

Heights come from each track's `displayDefaults`, and the row wrapper reads
`display.height` back rather than restating it, so a display that grows to fit
takes its neighbours with it. **`contain: strict` on that wrapper matters**:
displays position overlays absolutely, and without it a pileup's scrollbar
paints over the track below.

## The palette

Displays colour their own content from a palette: plain colour strings through
`SessionPaletteProvider`, no UI toolkit. **Every display needs it, including a
wiggle track** — its y-axis is React, not canvas, and with no provider
`usePalette()` falls back to JBrowse's light default whatever your page is.

**`PaletteProvider` is the near miss, and why the pairing ships as one
component.** The palette is what _React_ draws with. The config `theme` slot
also ships to the worker, where feature labels are baked into the image. Colour
React alone and those labels stay in the old mode, silently.
`SessionPaletteProvider` writes the one slot both derive from and provides the
palette that comes back.

Hovering still gets you Material UI in the bottom-right corner, deliberately:
this is the one page left stock for
[Removing Material UI](../removing-material-ui/#bring-your-own-overlays) to
swap.
