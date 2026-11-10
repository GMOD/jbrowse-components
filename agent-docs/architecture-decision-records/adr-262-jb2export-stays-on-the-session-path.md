---
status: Accepted
summary: "jb2export keeps building a session and calling the view's `renderToSvg`; the static hosts serve `@jbrowse/tables` only. Creating the session is about 10% of a small render and 2% of a BAM one, and a run is dominated by ~4 s of module loading"
---

# ADR-262: jb2export stays on the session path; the static hosts serve `@jbrowse/tables` only

## Status

Accepted (2026-11-09). Colin stopped the experiment once the number it waited
on was measured. Builds on the static hosts described in
[TABLES.md](../reference/TABLES.md#the-static-hosts).

## Context

`jb2export` (`products/jbrowse-img`) boots the interactive app headless:
`renderRegion` builds a session (`createViewStateAsync`), launches the view
and tracks, waits on `whenViewSettled`, then calls `renderToSvg`. The proposal
was to draw a display to SVG with no session instead: a frame computed from a
region list and a width, the display's fetch run in-process, the display's
views on the static host the tables already run, then the display's export
body.

Built and then removed:

- `staticWiggleSvg`, `staticFeaturesSvg` and `staticMarkSvg`, each a
  `./staticSvg` entry of its plugin, drawing through a
  `renderDisplaySvgInFrame` split out of `renderDisplaySvg`.
- `MarkStaticHost`, the mark display's static host, which no table ran.
- `staticLgvFrame` and `lgvChromeOf`, the LGV's frame and SVG chrome as plain
  objects, and `staticLgvSvg`, which laid the drawn tracks out through
  `lgvSvgDocument`.
- The members the feature host carried only for the SVG: its canvas width,
  the height chain past `fitTargetHeight`, `renderState` and
  `showsGroupLabels`.
- `staticWiggle.test.ts`, `staticFeatures.test.ts` and `staticMark.test.ts`
  in `products/jbrowse-img`, which compared each static body node by node
  with `renderRegion`'s and found no drift.

What stays: the static hosts the tables run, and the views functions the
display models install for them. `lgvSvgDocument` stays as the live
`renderToSvg`'s document.

## Decision

- **jb2export stays on the session path.** No per-display static exporter.
- **The static hosts serve `@jbrowse/tables` only.** A member a host installs
  is there because a table reads it, or because it comes with a chain the
  display installs through one installer.

The evidence, measured 2026-11-09 on the laptop over today's build and local
volvox data, warm medians in one process:

| Step | Time |
| --- | --- |
| Creating the session, 1–3 tracks | 10–14 ms |
| Creating the session, hosted hg38 config (799 tracks) | 34–57 ms |
| Whole session render, bigwig | 110–130 ms |
| Whole session render, GFF | 55 ms |
| Whole session render, BAM | 580–640 ms |
| Whole session render, hosted hg38 RefSeq genes | 350–480 ms |
| Static wiggle body alone | 7 ms |
| jsdom setup | 1.1 s |
| Importing the render stack | 2.7–3.1 s |
| Importing the static path alone | 1.7 s |

CPU time is at or above wall time in every render, so none of it waits on
timers. The session is about 10% of a small render and 2% of a BAM render. A
one-off run is dominated by about 4 s of module loading, of which the static
path saves about 1 s. The static wiggle body is 15 times faster per render,
which is 100 ms, and the batch use case is alignments, which had no static
port.

## Consequences

- Every display jb2export draws is drawn by the code the app draws it with,
  through one pipeline per mode.
- `renderDisplaySvg` is one function again, and a display's export body reads
  its model and the containing `RegionHost`.
- `@jbrowse/plugin-wiggle`, `-features` and `-marks` no longer publish
  `./staticSvg`, and `@jbrowse/core` no longer publishes
  `rpc/methods/executeEncodedLayers`.
- `MatrixRampMixin`'s ramp chain as views (branch `matrix-ramp-views`) waited
  for a static matrix consumer, and has no reason to land.
- A faster jb2export starts from module loading, not from the session.

## Rejected

- **A static SVG exporter per display.** Every display exporting through a
  `renderSvg` would need a views-function refactor, a static host and a
  parity test, to save 10% of a small render.
- **jb2export drawing from `@jbrowse/tables`.** Tables stop at data and the
  display's decisions, so it would need a second drawer per display.
- **One resolve function per display, called by the model's getters.** A
  getter calling it recomputes the whole chain when any input moves, losing
  the per-getter memo.
- **Making `launchTrack` throw so a headless caller sees failures.** Click
  handlers rely on its toast-and-undefined contract; failures reach a headless
  caller as `view.problems`.
