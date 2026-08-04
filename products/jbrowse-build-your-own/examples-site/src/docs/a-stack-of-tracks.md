A wiggle canvas, a feature layout and an alignments pileup, in one column. The
three could hardly be more different underneath — a BigWig read at summary
resolution, a Tabix'd GFF3 laid out into rows, a BAM piled up and mismatched
against the reference — and the code that mounts them does not know which is
which.

That is the whole point of the page. Every track carries an `activeDisplay`, and
every display exposes a `RenderingComponent`. Give one a box with a height and a
positioning context and it draws. Adding a fourth display type here means adding
a string to the list of track ids.

The heights come out of each track's `displayDefaults`, and the row wrapper
reads `display.height` back rather than restating it, so a display that grows to
fit its content takes its neighbours with it. `contain: strict` on the wrapper
matters more than it looks: displays draw their overlays absolutely positioned,
and without it a pileup's scrollbar paints over the track below.

## The pileup wants the wheel too

An alignments display scrolls its reads vertically inside itself, and it decides
whether the plain wheel is available by reading the same `view.scrollZoom` the
page's own handler reads. With scroll-to-zoom on, the plain wheel is taken by
the zoom, so shift+wheel is what the pileup scrolls with — which is why the
handler here leaves shift+wheel alone. See the
[Pan and zoom page](../pan-and-zoom/#pan-and-zoom) for the rest of that split.

## Where the palette arrives

The two pages before this one supply no palette at all, because a wiggle track
does not need one. A feature or alignments display does: it reads a palette to
colour its own **content** — the highlight box behind a searched-for feature,
the reading frames a CDS renderer paints. That is a plain object of colour
strings from `resolvePalette`, delivered through `PaletteProvider`, and no UI
toolkit is involved in it.

The demo also follows this site's own light/dark toggle, and that is one write
rather than two. Setting the mode on the session's **config** theme is enough,
because the config theme is what a display ships to its renderer — so the labels
baked into the canvas follow it — and `session.palette` is derived from the same
slot, so what React draws follows it too. Set only a React-side palette and the
labels stay behind in the old mode.

A display paints no background of its own, so it has to be told: its labels are
drawn straight onto whatever is behind them, and a light-theme label on a dark
page is near-black on near-black.

## Still stock

This is the last page that shows JBrowse's own chrome. Hover a track and you get
Material UI in the bottom-right corner: the track-sizing button every display
with a `heightMode` slot draws, and the isoform notice the feature display adds
while transcripts are collapsed. They are there deliberately, so that the
[next page](../bring-your-own-overlays/#bring-your-own-overlays) has something
to swap.
