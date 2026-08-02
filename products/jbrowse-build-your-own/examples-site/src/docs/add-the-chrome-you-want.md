Having taken all the chrome off, add back only the parts your app wants. Both
pieces below read the same view model the tracks read, so neither needs telling
when the user pans.

**The ruler** needs two view methods. `dynamicBlocks.contentBlocks` is what is
on screen right now, one entry per contiguous region, and `bpToPx` turns a
genomic coordinate into a pixel offset. `chooseGridPitch` from
`@jbrowse/core/util/chooseGridPitch` picks a round tick spacing for the current
zoom so labels do not collide.

**The labels** read `track.activeDisplay.height`, so they stay aligned if a
track is resized or a display grows to fit its content.

## Where to stop

JBrowse's own label layer also does drag-to-reorder, a per-track menu, and an
overlap mode that floats the label over the data. Its ruler also does region
boundaries, cytobands, and the rubberband selection. Rebuilding those is not a
good use of your time.

The reason to start from the parts is not that the finished component is bad. It
is that "a genome track inside an app that already has a design system" and "a
genome browser" are different products, and only you know which one you are
building. If you find yourself adding back the fourth or fifth piece of chrome,
that is a good signal to switch to
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/) and
theme it instead.
