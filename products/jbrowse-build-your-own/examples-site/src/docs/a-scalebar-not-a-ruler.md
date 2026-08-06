A ruler is a `for` loop over one tick pitch. A scalebar is that plus what
happens once more than one region is on screen, and the view has already worked
all of it out.

`view.gridlineTicks` gives `{x, major}` per tick and `view.scalebarLabels` gives
`{x, label, key}` per label, off the same formula, so a number always sits on a
line. The view drops the labels that would collide — with a region edge, with
the region's name, with each other — and formats them for the zoom (`1,000` up
close, `10.5kb` out).

Both x values are in the `staticBlocks` frame: a pixel space spanning every
displayed region, not the viewport, with its origin at `staticBlocks.offsetPx`.
One element translated by `staticBlocks.offsetPx - view.offsetPx` places every
tick at once, and a pan moves that transform instead of each tick.

A region's name is drawn at `max(blockStartPx, 0)` and clipped at
`view.scalebarRegionEndPx.get(index)`, so it rides the viewport edge as you pan
through the region and leaves with the region's right edge. Hang it on the
region's first block, though, and it vanishes as soon as you zoom in past that
block — `staticBlocks` only covers what is on screen. Hang it on the rightmost
block that has scrolled off the left edge, which is what JBrowse does.

Drag across the row to zoom: `view.pxToBp(px)` turns a pixel offset into an
anchor in a displayed region, and `view.moveTo(start, end)` frames the span
between two of them. Measure the container's left edge at the press —
`getBoundingClientRect` in a pointermove handler forces layout on every frame of
the drag. The row carries `data-gesture-owner`, the marker the page's pan
handler tests before starting a drag of its own; JBrowse's own scalebar carries
it for the same reason.

Everything here reads block geometry, and `staticBlocks` throws until the
ResizeObserver has reported a width, so it all sits inside one `view.ready`
gate.

Colors come from `usePalette()`, the toolkit-free counterpart to Material UI's
`useTheme` and the same hook JBrowse's own displays read — chrome you write then
follows the app's theme along with the data, and `gridlineMinor` /
`gridlineMajor` are already in it. Not the CSS system colors: `Canvas` and
`CanvasText` follow the _browser's_ color scheme rather than the app's, so a
dark app that has not set `color-scheme` gets a white label box.

What is still missing next to
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/):
cytobands, the per-region menu on a name, the overview scalebar above it, and a
hover guideline.
