The mouse is not the only thing that moves a genome browser. Your app knows
things — a gene the user searched for, the row they clicked in a table, the
region a job just finished analysing — and getting the browser there is four
calls and one getter. None of them is a component, so the toolbar below could
equally be your app's own header, three floors up the tree.

## Navigating

`view.navToLocString(input)` takes what a user would type. `ctgA`, a whole
contig; `ctgA:1,050..9,000`; several regions separated by spaces. It resolves
reference names through the assembly's aliases, so `chr1` finds a `1`, replaces
`displayedRegions` when the destination needs different ones, and clamps the
zoom to what the view allows.

Two things about it are easy to get wrong:

- It is **async**, because it waits for the assembly to be ready. That also
  means you can call it immediately after `createViewState`, before anything has
  loaded, and it will do the right thing.
- It **throws** on anything it cannot resolve. A box with no `.catch` looks like
  it ignored the typo.

## Reading the location back

`view.coarseVisibleLocStrings` is the location as a string, recomputed on a
500ms tick. `view.visibleLocStrings` is the same thing live — and rendering
_that_ into an input re-renders it on every frame of a drag, for a number nobody
can read mid-gesture. Use the coarse one for anything a person looks at, and the
live one only if you are drawing.

The box in the demo is the general shape of a control that is both live and
editable: the view is the source of truth, but a keystroke parks a local draft
that wins until the user submits or presses Escape. Without that, a pan midway
through typing overwrites what they were typing.

## Showing and hiding tracks

`view.showTrack(trackId)` instantiates the track and its display from the config
with that id; `view.hideTrack(trackId)` removes it and disposes what it held.
Neither adds anything to the config — they turn on what is already declared.

The checkboxes read `view.tracks` rather than a `useState` beside them. That is
not tidiness: as soon as anything else can show a track — a bookmark that
arrives with its own list, a saved session, another panel in your app — a
separate copy of the answer starts drifting from the real one.

## Zooming

`view.zoom(bpPerPx)` eases to the target and yields if anything else moves the
view, which is what JBrowse's own header buttons call.
`view.zoomTo(bpPerPx, offsetPx)` is the same move without the animation, and
takes a pixel to keep anchored — that is the one a wheel handler wants. Neither
needs a range check; the view clamps to the limits it derives from the assembly.
