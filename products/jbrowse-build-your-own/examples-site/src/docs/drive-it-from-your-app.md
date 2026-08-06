Navigating, zooming and showing tracks are four calls and one getter on the view
model. None is a component, so the toolbar above could be your app's own header,
three floors up the tree.

## Navigating

`view.navToLocString(input)` takes what a user would type: `ctgA`,
`ctgA:1,050..9,000`, or several regions separated by spaces. It resolves
reference names through the assembly's aliases, replaces `displayedRegions` when
needed, and clamps the zoom. It is async because it waits for the assembly, and
**it throws on anything it cannot resolve** — a box with no `.catch` looks like
it ignored the typo.

## Two regions, and the line between them

Several regions lay out **contiguously** — no gap, no marker. The boundary is
drawn by the container JBrowse wraps around a track, not by the display, so
mounting `RenderingComponent` yourself gets both regions and no seam.
`RegionBoundaries` below draws it: the blocks flagged
`isRightEndOfDisplayedRegion`, at `block.offsetPx - view.offsetPx`.

## Reading the location back

`view.coarseVisibleLocStrings` recomputes on a 500ms tick;
`view.visibleLocStrings` is live, and re-renders an input every frame of a drag
for a number nobody can read mid-gesture. **Use the coarse one for anything a
person looks at.** The box in the demo shows the rest: the view is the source of
truth, but a keystroke parks a local draft that wins until submit or Escape.

## Showing, hiding, zooming

`view.showTrack(trackId)` instantiates the track and its display from the config
with that id; `hideTrack` disposes it. Neither touches the config. The
checkboxes read `view.tracks` rather than a `useState` beside them — as soon as
anything else can show a track, a separate copy of the answer drifts.

`view.zoom(bpPerPx)` eases and yields if anything else moves the view;
`view.zoomTo(bpPerPx, offsetPx)` is the same move without animation, anchored on
a pixel — the one a wheel handler wants.
