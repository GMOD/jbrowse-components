A BigWig, a Tabix'd GFF3 and a BAM in one column. Every track exposes a
`RenderingComponent`, so the mounting code doesn't know which is which and a
fourth track is one more string in a list of ids.

Heights come from each track's `displayDefaults`, and the row wrapper reads
`display.height` back rather than restating it, so a display that grows to fit
takes its neighbours with it. **`contain: strict` on that wrapper matters more
than it looks**: displays draw overlays absolutely positioned, and without it a
pileup's scrollbar paints over the track below.

## The palette

A feature or alignments display reads a palette to colour its own content — the
highlight behind a searched feature, the reading frames a CDS renderer paints.
Plain colour strings through `PaletteProvider`, no UI toolkit. A wiggle track
needs none, which is why the earlier pages supply none.

Following your app's light/dark toggle is one call,
`useSessionPalette(session, mode)`; how the host knows its own mode is the
host's business, and the hook deliberately doesn't ask.

**Mounting `PaletteProvider` alone is the trap it exists to close.** The palette
is what _React_ draws with, while the config `theme` slot is also what ships to
the worker, where feature labels are baked into the image. Supply only the first
and those labels stay in the old mode with no error anywhere — and since a
display paints no background, a light-theme label on a dark page is near-black
on near-black. `useSessionPalette` writes the one slot both derive from, which
is why it hands back the palette rather than taking one.

Hovering still gets you Material UI in the bottom-right corner: the track-sizing
button and the isoform notice. Deliberately: this is the one page left stock, so
[Removing Material UI](../removing-material-ui/#bring-your-own-overlays) has
something to swap.
