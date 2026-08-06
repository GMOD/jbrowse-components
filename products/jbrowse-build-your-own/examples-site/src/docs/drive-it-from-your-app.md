Navigating, zooming and showing tracks are four calls and one getter on the view
model. None of them is a component, so the toolbar in the demo could equally be
your app's own header, three floors up the tree.

## Navigating

`view.navToLocString(input)` takes what a user would type: `ctgA`, a whole
contig; `ctgA:1,050..9,000`; several regions separated by spaces. It resolves
reference names through the assembly's aliases, so `chr1` finds a `1`, replaces
`displayedRegions` when the destination needs different ones, and clamps the
zoom to what the view allows.

It is async, because it waits for the assembly to be ready — which also means
you can call it immediately after `createViewState`. And it throws on anything
it cannot resolve, so a box with no `.catch` looks like it ignored the typo.

## Two regions, and the line between them

Several regions in one locstring become several `displayedRegions`, laid out
**contiguously** — no gap and no marker between them. JBrowse's own boundary is
drawn by the container it wraps around a track, not by the display, so mounting
`RenderingComponent` yourself gets you both regions and no seam. Until you draw
one, two regions look like one region that scrolled somewhere strange.

`view.staticBlocks` is the block layout the view just rendered, spanning every
displayed region, and `view.offsetPx` is where the viewport sits in it — so a
block's screen x is `block.offsetPx - view.offsetPx`, and the ones flagged
`isRightEndOfDisplayedRegion` are where a region ends. `RegionBoundaries` in the
source below is the whole thing: a filter and an absolutely positioned div.

## Reading the location back

`view.coarseVisibleLocStrings` is the location as a string, recomputed on a
500ms tick. `view.visibleLocStrings` is the same thing live, which re-renders an
input on every frame of a drag for a number nobody can read mid-gesture. Use the
coarse one for anything a person looks at.

The box in the demo is the general shape of a control that is both live and
editable: the view is the source of truth, but a keystroke parks a local draft
that wins until the user submits or presses Escape — otherwise a pan midway
through typing overwrites what they were typing.

## Showing and hiding tracks

`view.showTrack(trackId)` instantiates the track and its display from the config
with that id; `view.hideTrack(trackId)` removes it and disposes what it held.
Neither adds anything to the config — they turn on what is already declared.

The checkboxes read `view.tracks` rather than a `useState` beside them: as soon
as anything else can show a track — a saved session, another panel in your app —
a separate copy of the answer drifts from the real one.

## Zooming

`view.zoom(bpPerPx)` eases to the target and yields if anything else moves the
view, which is what JBrowse's own header buttons call.
`view.zoomTo(bpPerPx, offsetPx)` is the same move without the animation, taking
a pixel to keep anchored — the one a wheel handler wants.
