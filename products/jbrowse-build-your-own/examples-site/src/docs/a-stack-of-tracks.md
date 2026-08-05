A wiggle canvas, a feature layout and an alignments pileup in one column — a
BigWig read at summary resolution, a Tabix'd GFF3 laid out into rows, a BAM
piled up and mismatched against the reference. Every track carries an
`activeDisplay` exposing a `RenderingComponent`, so the code that mounts them
does not know which is which, and adding a fourth means adding a string to the
list of track ids.

The heights come out of each track's `displayDefaults`, and the row wrapper
reads `display.height` back rather than restating it, so a display that grows to
fit its content takes its neighbours with it. `contain: strict` on the wrapper
matters more than it looks: displays draw their overlays absolutely positioned,
and without it a pileup's scrollbar paints over the track below.

An alignments display scrolls its reads vertically inside itself, and reads the
same `view.scrollZoom` the page's own handler reads to decide whether the plain
wheel is available. With scroll-to-zoom on the wheel is taken by the zoom, so
shift+wheel is what the pileup scrolls with — see
[Pan and zoom](../pan-and-zoom/#pan-and-zoom) for the rest of that split.

## The palette

A feature or alignments display reads a palette to colour its own content — the
highlight box behind a searched-for feature, the reading frames a CDS renderer
paints. That is a plain object of colour strings from `resolvePalette`,
delivered through `PaletteProvider`; no UI toolkit is involved. A wiggle track
needs none, which is why the two pages before this supply none.

Following a light/dark toggle is one write rather than two: set the mode on the
session's **config** theme. That is what a display ships to its renderer, so the
labels baked into the canvas follow it, and `session.palette` is derived from
the same slot, so what React draws follows too. Set only a React-side palette
and the labels stay behind in the old mode — and since a display paints no
background of its own, a light-theme label on a dark page is near-black on
near-black.

## Still stock

Hover a track and you get Material UI in the bottom-right corner: the
track-sizing button every display with a `heightMode` slot draws, and the
isoform notice the feature display adds while transcripts are collapsed. They
are there deliberately, so that the
[next page](../bring-your-own-overlays/#bring-your-own-overlays) has something
to swap.
