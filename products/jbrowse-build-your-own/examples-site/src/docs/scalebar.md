A ruler is a `for` loop over one tick pitch. A scalebar is that plus what
happens once more than one region is on screen, and the view has worked all of
it out already.

`view.gridlineTicks` gives `{x, major}` per tick and `view.scalebarLabels` gives
`{x, label, key}` per label, off the same formula, so a number always sits on a
line. The view drops labels that would collide and formats them for the zoom.

**Both x values are in the `staticBlocks` frame**: a pixel space spanning every
displayed region, not the viewport. One element translated by
`staticBlocks.offsetPx - view.offsetPx` places every tick at once, and a pan
moves that transform instead of each tick.

`view.scalebarRefNameLabels` hands back each region's name already placed. Three
rules live inside it: which block carries the sliding label (not the region's
_first_, which vanishes once you zoom past it), one label per run of a refName,
and whole name or none, since `chr16` clipped reads as `chr1`.

Drag across the row to zoom: `view.pxToBp(px)` turns a pixel offset into an
anchor and `view.moveTo(start, end)` frames the span between two. Colours come
from `usePalette()`, the toolkit-free counterpart to MUI's `useTheme`.
