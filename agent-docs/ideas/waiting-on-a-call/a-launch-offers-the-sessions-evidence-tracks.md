---
name: a-launch-offers-the-sessions-evidence-tracks
description: A breakpoint split view launched from the SV inspector opens only the `drilldownTracks` a config author knew to write, a launch from a read carries no callset, and the cgiab tutorial has the reader add tumor reads to each panel by hand. The launch dialog should list the session's alignment, variant and quantitative tracks for the assembly as a checklist, remembered like the window size, so the panels arrive at the right loci holding the evidence.
---

# A launch offers the session's evidence tracks

`openOrReuseSplitView` fills a new view's panels from one of three sources:
the tracks of the `view` the launch came from, the `defaultTrackIds` the SV
inspector passes from `drilldownTracks`, or nothing. The SV inspector has no
source view, so without the config key its panels are empty; a read's launch
copies its own view, so the panels hold the callset only if the reader had it
open; and the tutorial workaround is per-panel track menus.

The evidence for a junction is the same short list every time. Tumor reads,
normal reads, the callset, a copy-number or BAF track. The session already
holds them, since the reader loaded them to get here.

## The change

- The choice dialog gains a track checklist under its options, listing every
  alignment, variant and quantitative track of the launch's assembly that is
  open in any view of the session, plus the `drilldownTracks` the config names,
  each pre-ticked, and the callset the launch came from ticked and first.
- The ticked set is remembered in `localStorage` beside the window size, so
  the second launch of a review session is one click.
- A launch that has a `view` still copies it, and the checklist adds to the
  copy, so "Copy tracks" keeps its meaning.
- Every launch path passes the callset it came from. The variant feature
  widget's link (`LaunchBreakendPanel.tsx`) passes neither the callset nor a
  `findJunctionsNear`, so it can follow no chain; the alignments widget's link
  passes only the read.

## What it waits on

A call on the dialog growing a list. The dialog is already the one place every
launch passes through, which is the argument for putting it there. A per-panel
menu would be a second place.
