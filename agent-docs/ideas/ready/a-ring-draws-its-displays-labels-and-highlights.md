---
name: a-ring-draws-its-displays-labels-and-highlights
description: A ring on the circular view samples its display's canvas, so every DOM layer the display draws — feature labels, text marks, hover, selection and pinned highlights — stays in the hidden strip and a gene ring has no names. One polar SVG overlay in the figure's rotated group re-places what each ring display already computes in strip px, on screen and in the export alike. The design, the one seam labels need, the re-cull at the ring's own size, and the four calls already made.
---

# A ring draws its display's labels and highlights

ADR-119 made every linear display a ring by resampling its strip's canvas. What
the display draws as DOM rather than canvas never reaches the ring:

- canvas feature labels (`FloatingLabelsLayer`,
  `plugins/canvas/src/LinearBasicDisplay/components/overlayElements.tsx`);
- the mark display's text marks (ADR-162, placed by `placeTextMarks` inside
  `MarkTextLayer`);
- hover, selection, pinned and solo highlights (`HighlightHost` in
  `packages/display-kit/src/highlightHost.ts`, drawn by `ChromeHighlight` as a
  div).

A plot-only export leaves the text marks out for the same reason, so the
export agrees with the screen until this lands.

## The design

One component in the figure's rotated `<g>`, beside `RingAxes`, mounted by
`CircularView.tsx` and `SVGCircularView.tsx` alike. It maps a strip point to the
ring the way `ringHit` maps back: angle `x / host.stripRadiusPx` (never
`view.radiusPx`, which ignores `stripScale`), radius
`ring.outerPx − y / stripPerRingPx(ring)` against the untrimmed band, so it
never needs `canvasBox`. Chrome px is strip px.

- **Highlights** read `hoverInk`, `selectionInk` and `pinnedInk` off the ring
  display, which `renderDisplaySvg` already does from outside for `pinnedInk`.
  A rect becomes an annular sector clamped to the band, with the large-arc flag
  past π. The export draws pinned only, as a linear export does.
- **Labels** have no model member today: both layers call their placement
  inside a component. The seam is a structural `FloatingLabelHost` in
  display-kit shaped like `HighlightHost` — `floatingLabels(theme)` answering
  `{ key, x, y, width, text, color, fontSize }` in chrome px — which the canvas
  and mark displays implement by calling the placement their DOM layer already
  calls, and which that layer then reads too.
- **Re-cull at the ring's size.** A label placed for the strip needs
  `stripRadiusPx / r` times the angle on a ring at radius `r`, up to about 2×
  on the innermost ring, so labels that fit the strip overlap there.

Reversed (mirrored) blocks need nothing: the overlay takes px, never bp.
Elided blocks carry nothing.

## Decided

- **Orientation follows the ruler's rule:** along the arc when every label on
  the ring fits its span, else radial, one orientation per ring — the rule
  `labelsRunAlongArcs` states for the chromosome labels. `labelPlacement`
  moves out of `Ruler.tsx` into `rulerLabels.ts` for both to call.
- **A label that no longer fits is dropped**, at the ring's own size, rather
  than shrunk.
- **A ring shows hover, selection and pinned**, as a linear track does.

Every label reads `offsetRadians` to pick its flip, so measure a rotation
drag with a dense ring before shipping; a computed that changes only when a
label crosses the horizontal is the fallback.

## The work

About 350 production lines over 11 files and as many test lines: a pure
`rings/ringPolar.ts` (`stripPointToPolar`, `stripRectToSectorPath`,
`cullRingLabels`) with a round trip against `ringHit` including a shrunk band
and `stripScale < 1`; `rings/RingOverlay.tsx`; `floatingLabelHost.ts` with its
exports-map entry; the two display implementations; and an amendment to
ADR-119's consequences and ADR-162's circular-view clause.
