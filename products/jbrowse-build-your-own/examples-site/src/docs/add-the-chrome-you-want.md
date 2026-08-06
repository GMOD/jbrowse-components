Having taken all the chrome off, add back only what your app wants. Both pieces
read the same view model the tracks read, so neither needs telling when the user
pans.

The **ruler** needs two view methods: `dynamicBlocks.contentBlocks` is what is
on screen right now, one entry per contiguous region, and `bpToPx` turns a
coordinate into a pixel offset. `chooseGridPitch` from
`@jbrowse/core/util/chooseGridPitch` picks a round tick spacing for the zoom so
labels don't collide.

The **labels** read `track.activeDisplay.height`, so they stay aligned when a
track is resized or a display grows to fit.

The **resize bars** are the only piece that writes.
`display.resizeHeight(deltaPx)` is the whole resize — it clamps to the minimum,
and knows a manual drag on a grow-to-fit track means "stop growing, I want this
height". Bracket the gesture with `display.setResizing(true/false)` so displays
that restretch rows per frame can sit an expensive layer out. The bar carries
`data-gesture-owner`, the marker the page's pan handler tests before starting a
drag of its own; without it, dragging to resize pans the view sideways instead.

If you find yourself adding back a fourth or fifth piece of chrome, switch to
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/) and
theme it instead.
