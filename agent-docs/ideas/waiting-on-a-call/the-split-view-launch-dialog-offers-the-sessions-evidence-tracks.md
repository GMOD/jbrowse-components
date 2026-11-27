---
name: the-split-view-launch-dialog-offers-the-sessions-evidence-tracks
description: A breakpoint split view opens holding whatever its launcher carried, often nothing; the launch dialog could list the session's alignment, variant and quantitative tracks pre-ticked, and every launch path could pass the callset it came from.
---

# The split-view launch dialog offers the session's evidence tracks

`openOrReuseSplitView` (`packages/sv-core/src/openSplitView.ts`) fills a new
view's panels from the `view` the launch came from, from the
`defaultTrackIds` the SV inspector passes off `drilldownTracks`, or from
nothing. The SV inspector has no source view, so without the config key its
panels are empty; a read's launch copies its own view, so the panels hold the
callset only if the reader had it open; the cgiab tutorial's workaround is
per-panel track menus. The evidence for a junction is the same short list every
time (tumor reads, normal reads, the callset and a copy-number or BAF track),
and the session already holds it.

- The choice dialog gains a track checklist under its options, listing every
  alignment, variant and quantitative track of the launch's assembly open in
  any view of the session plus the `drilldownTracks` the config names, each
  pre-ticked, with the callset the launch came from first.
- The ticked set is remembered in `localStorage` beside the window size.
- A launch with a `view` still copies it and the checklist adds to the copy,
  so "Copy tracks" keeps its meaning.
- Every launch path passes the callset it came from. The variant widget's link
  (`LaunchBreakendPanel.tsx`) passes neither the callset nor a
  `findJunctionsNear`, so the dialog opened from the feature detail never
  offers the chain the same record's right-click offers; the alignments
  widget's link passes only the read. `makeFindJunctionsNear` wants a node
  holding the track's `adapterConfig`, which the widget model does not carry:
  the widget resolves its track from the feature's `trackId`, or shares the
  right-click's launcher.

The call is the dialog growing a list. It is already the one place every launch
passes through, and a per-panel menu would be a second place.
