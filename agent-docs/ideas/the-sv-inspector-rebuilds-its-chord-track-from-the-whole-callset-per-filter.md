---
name: the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter
description: a changed filter tears down and rebuilds a chord track whose config carries the whole callset inline, which on the 66,709-record HG002 callset is a 7s main-thread block to get back to every row; nobody has apportioned that block between the rebuild and the data grid, and the structural fix changes what the SV inspector persists
---

# The SV inspector rebuilds its chord track from the whole callset per filter

`featuresCircularTrackConfiguration` carries every visible feature inline, so a
changed filter means `hideTrack` + `launchTrackConf` on a conf holding the
callset. Each change then costs, in order:

- `showTrackGeneric` `structuredClone`s the conf and, because it is a plain
  object and no state-tree node, runs `trackType.configSchema.create` on it
  purely to produce a nice error message, throws the result away, and creates it
  for real.
- `installChordFetch` in `BaseChordDisplay.ts` clones the adapter config again
  in `prepare`, walks it a third time for the structural `fetchKey`, and waits
  out `delay: 300`.
- `CoreGetFeatures` and `CoreGetRefNames` each ship that config to the worker,
  and the features come back serialized. They began on the main thread.
- `onBegin` blanks `features`, so every filter change flashes Loading.

## What is measured

`products/jbrowse-web/test_data/breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz`
is 66,709 records and is in the tree, with a config beside it. On a production
build from 2026-09-20, headless Chrome, SV type filter set from the model:

| filter lands on | rows | main-thread block | circle drawn again |
| --- | --- | --- | --- |
| INV | 70 | 0.4s | 0.6s |
| BND | 6,828 | 0.7s | 1.1s |
| DEL | 24,799 | 2.2s | 3.6s |
| every row | 66,709 | 7.0s | 11.0s |

The two RPC calls took 2.6s and 1.2s of the every-row case, so most of the
block is main-thread work. That build predates the dropdowns moving off the
grid's filter model, so its block also holds the data grid re-filtering 66,709
rows, and **nobody has profiled the block to split the rebuild from the grid.**
A dev build cannot do it: the state tree type-checks every snapshot in
development, which inflates exactly the validation this doc is about.

The browser's paint of the chords used to dwarf all of it and no longer does:
`chordPath` leaves a chord under a pixel long unmounted, which took that
callset's open from 317s to 19s on a dev build.

## Two independent fixes, cheapest first

- Skip the throwaway validate for a conf built internally and not read from
  user config. Contained, but it lives in `util/tracks.ts` and every showTrack
  path in the app goes through it, so it wants its own tests.
- Stop embedding the features at all: give ChordVariantDisplay a source that
  reads `visibleRows` off the spreadsheet model in place of a
  `FromConfigAdapter` snapshot, so a filter change becomes a re-render and no
  track is torn down. Bigger: it needs its own refName mapping, its own
  `svgReady` and `displayPhase`, and it changes what the SV inspector persists.
  The event highlight shows the shape of the cheap half of it, since the
  inspector already writes display state (`setHighlightedFeatureIds`) onto the
  chord display without touching the track.

Profile the every-row block on a production build before building either. The
redundant rebuilds are already gone — `setVisibleRows` compares before writing
(`sameVisibleRowFlags` in `SpreadsheetModel.tsx`) — so what is left is genuine
filter changes only.
