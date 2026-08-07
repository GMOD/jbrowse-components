A ruler is a `for` loop over one tick pitch. A scalebar is that plus what
happens once more than one region is on screen — and the view has already worked
all of it out.

`view.gridlineTicks` gives `{x, major}` per tick and `view.scalebarLabels` gives
`{x, label, key}` per label, off the same formula, so a number always sits on a
line. The view drops labels that would collide and formats them for the zoom
(`1,000` up close, `10.5kb` out).

**Both x values are in the `staticBlocks` frame**: a pixel space spanning every
displayed region, not the viewport, origin at `staticBlocks.offsetPx`. One
element translated by `staticBlocks.offsetPx - view.offsetPx` places every tick
at once, and a pan moves that transform instead of each tick.

`view.scalebarRefNameLabels` hands back each region's name already placed —
`{text, transform, maxWidth, paddingLeft}`, the set JBrowse's own scalebar
draws. Three rules live inside it, each a bug you would otherwise ship once:
which block carries the sliding label (not the region's _first_, which vanishes
once you zoom past it), one label per run of a refName, and whole name or none,
since `chr16` clipped reads as `chr1`.

Drag across the row to zoom: `view.pxToBp(px)` turns a pixel offset into an
anchor and `view.moveTo(start, end)` frames the span between two. Measure the
container's left edge at the press — `getBoundingClientRect` in a pointermove
handler forces layout every frame. The row carries `data-gesture-owner` so the
page's pan handler leaves it alone.

Everything here reads block geometry, and `staticBlocks` throws until the
ResizeObserver has reported a width, so it all sits inside one `view.ready`
gate.

Colours come from `usePalette()`, the toolkit-free counterpart to MUI's
`useTheme`. Not the CSS system colors: `Canvas`/`CanvasText` follow the
_browser's_ scheme, so a dark app that hasn't set `color-scheme` gets a white
label box.
