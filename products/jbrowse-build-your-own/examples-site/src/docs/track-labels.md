The other half of what an app draws around its data, and much less code than the
row above: a column of labels beside the tracks, and a bar to drag each one
taller. Both read the same view model the tracks read, so neither needs telling
when the user pans.

The labels read `track.activeDisplay.height`, so they stay aligned when a track
is resized or a display grows to fit.

The resize bars are the only piece that writes. `display.resizeHeight(deltaPx)`
is the whole resize: it clamps to the minimum, and knows a manual drag on a
grow-to-fit track means "stop growing". Bracket the gesture with
`display.setResizing(true/false)` so displays that restretch rows per frame can
sit that layer out.

The bar is yours. The drag behind it isn't. `useResizeDrag` from
`@jbrowse/core/util/useResizeDrag` spreads props onto whatever you draw and
reports one distance per animation frame. `data-gesture-owner` rides in those
props. Without it, dragging to resize also pans the view sideways.
