Having taken all the chrome off, add back only the parts your app wants. Both
pieces below read the same view model the tracks read, so neither needs telling
when the user pans.

The **ruler** needs two view methods: `dynamicBlocks.contentBlocks` is what is
on screen right now, one entry per contiguous region, and `bpToPx` turns a
genomic coordinate into a pixel offset. `chooseGridPitch` from
`@jbrowse/core/util/chooseGridPitch` picks a round tick spacing for the current
zoom so labels do not collide.

The **labels** read `track.activeDisplay.height`, so they stay aligned if a
track is resized or a display grows to fit its content.

The **resize bars** are the only piece that writes rather than reads.
`display.resizeHeight(deltaPx)` is the whole resize — it clamps to the display's
minimum, and it knows that a manual drag on a grow-to-fit track means "stop
growing, I want this height". Bracket the gesture with
`display.setResizing(true/false)` so displays that restretch their rows per
frame can sit an expensive layer out of the drag. The bar carries
`data-gesture-owner`, the marker the page's own pan handler tests before
starting a drag; without it, dragging to resize would pan the view sideways
instead.

JBrowse's own label layer also does drag-to-reorder, a per-track menu and an
overlap mode, and its ruler does region boundaries, cytobands and rubberband
selection. If you find yourself adding back a fourth or fifth piece of chrome,
switch to
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/) and
theme it instead.
