---
name: jb2export-draws-the-capture-callouts
description: jb2export has no callouts; `jb2capture --annotations` does. The LGV export resolves loc, feature, row and dotplot anchors without a browser once the overlay is split into anchor → rect and rect → SVG, shared by both tools.
---

# jb2export draws the capture callouts

## Ruling

The whole vocabulary through the shared split: anchor to rect per host, then
rect to SVG elements as data, so one spec draws the same callouts in both tools.
It is the version that cannot drift.

`jb2capture --annotations` draws arrows, boxes, pills, badges, legends and
lineage wedges over a live page (`products/jbrowse-capture/src/annotationOverlay.ts`).
jb2export draws none, so a figure built with it gets its callouts in an image
editor, which is what the capture overlay was written to end.

## What resolves without a browser

ADR-262 keeps jb2export on the session path, so the session and its displays
exist when the SVG is written, and the model answers what the DOM answers in
capture:

- `loc`: the view's `getHighlightCoords`, a pure model call, offset by the
  export's own track tops (`trackBoxOffsets` in
  `plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/util.ts`), not
  the on-screen `trackYOffsets`.
- `feature`: the display's `featuresNamed`, if the export's `renderDataMap` is
  what the SVG drew. Unverified.
- `row`: `rowsTopOffset` and `effectiveRowHeight`, without the on-screen
  `scrollTop` and viewport clipping `rowAnchor.ts` applies.
- `hLoc`/`vLoc`: the dotplot axes' `bpToPx`.

`selector`, `text` and `residue` name a page element or a WebGL camera and stay
capture-only; jb2export has no graph view for `graphNode`.

## The split it needs

`drawAnnotationOverlay` is page code: `document.createElementNS` and `getBBox`
to size each pill. Shared, it becomes:

- anchor → rect, one resolver per kind, per host (page or SVG export);
- rect → SVG elements as data, with text measured by core's `measureText`
  (`packages/core/src/util/measureText.ts`). Its Helvetica table over-measures
  jb2export's default serif, the safe direction for a pill's width.

The overlay goes in `lgvSvgDocument`
(`plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/lgvSvgDocument.tsx`)
as a `<g>` after `<SVGViewChrome>` inside the `exportMargin` translate, the one
place holding `tracksTop`, the label gutter and the rows. The
`LinearGenomeView-HighlightSVGComponent` extension point is clipped to the
tracks area and would cut off a pill in the margin; `wrapSvgExport`'s `Wrapper`
wraps outside the `<svg>`.

## The options

- The whole vocabulary (ruled) through the split above, so one spec draws the same
  callouts in both tools; or
- a subset (`box`, `text` with `leader`, `arrow` on `loc` anchors) written
  straight into the export, with no shared code.

The first is the one that cannot drift; the second ships the common figure in a
day. `--highlight` (`renderRegion.ts`, `session.addHighlight`) already covers a
plain band either way.
