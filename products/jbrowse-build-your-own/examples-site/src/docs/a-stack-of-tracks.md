A wiggle canvas, a feature layout and an alignments pileup in one column — a
BigWig at summary resolution, a Tabix'd GFF3 laid out into rows, a BAM piled up
and mismatched against the reference. Every track exposes a
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
That is a plain object of colour strings from `resolvePalette`, through
`PaletteProvider`; no UI toolkit involved. A wiggle track needs none, which is
why the earlier pages supply none.

Following a light/dark toggle is **one write, not two**: set the mode on the
session's _config_ theme. That is what a display ships to its renderer, so
labels baked into the canvas follow, and `session.palette` derives from the same
slot so React follows too. Set only a React-side palette and the labels stay in
the old mode — and since a display paints no background, a light-theme label on
a dark page is near-black on near-black.

Hovering still gets you Material UI in the bottom-right corner: the track-sizing
button and the isoform notice. Deliberately, so the
[next page](../bring-your-own-overlays/#bring-your-own-overlays) has something
to swap.
