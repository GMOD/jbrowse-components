Navigating, zooming and showing tracks are four calls and one getter on the view
model. None is a component, so the toolbar above could be your app's own header,
three floors up the tree.

`view.navToLocString(input)` takes what a user would type: `chr17`,
`chr17:43,044,295..43,125,364`, or several regions separated by spaces. It is
async, and **throws on anything it cannot resolve**: a box with no `.catch`
looks like it ignored the typo.

`view.showTrack(trackId)` instantiates the track and its display from the config
with that id. `hideTrack` disposes it. Neither touches the config. The
checkboxes read `view.tracks` rather than a `useState` beside them, since a
second copy of the answer drifts as soon as anything else can show a track.

**Use `view.coarseVisibleLocStrings` for anything a person looks at.** It
recomputes on a 500ms tick. `view.visibleLocStrings` is live, and re-renders an
input every frame of a drag.

## Two regions, and the line between them

Several regions lay out contiguously: no gap, no marker. The boundary comes from
the container JBrowse wraps around a track, not the display, so mounting
`RenderingComponent` yourself gets both regions and no seam.

`RegionBoundaries` below draws it from `view.paddingSpans` — `{x, width, kind}`
per span, where `kind` is a region's right edge, the greyed ends of the genome,
or a region too narrow to draw. Those x values are in the `staticBlocks` frame,
so one wrapper translated by `view.staticBlocksTranslateX` places every span at
once. **Don't derive this from `isRightEndOfDisplayedRegion`**: that flag is set
on elided blocks too, so a bar per region is a solid grey wall at whole-genome
zoom, and drawing only the seams loses the elided tail of a genome entirely.
