---
name: display-chrome-owns-the-container-height
description: Four displays pass style={{ height: model.height }} to DisplayChrome, and TooLargeMessage renders at intrinsic height where the error overlay takes model.height. Both are duplication rather than drift; the call is whether alignments' minHeight and arc's intrinsic sizing are deliberate, since those two would newly gain a height.
---

# DisplayChrome owns the container height

Split out of the 2026-07 architecture review's deferred items on 2026-09-27.
The review's `dataCurrent` item closed on its own: `foundationSvgReady.ts` types
it as a required boolean. Its `{...divProps}` item is benign by design
(ADR-025).

- **Four displays pass `style={{ height: model.height }}`** to `DisplayChrome`
  (maf, multi-sample variant, multi-row feature, basic feature), which already
  takes the model and supplies `position: relative` as a caller-overridable
  default in the same object literal. Every one is `model.height`, so unlike
  `canvasWidthPx` there is no second spelling to disagree later.
- **`TooLargeMessage` renders at intrinsic height** while
  `DisplayRenderErrorOverlay` gets `height={model.height}`. Threading height
  through `TooLargeMessage` → `BlockMsg` could churn many displays' too-large
  snapshots.

## The call

The two displays that would newly gain a height are the two where its absence
looks deliberate: alignments uses `minHeight: '100%'`, and arc's
`DisplayStatusChrome` passes no style and sizes intrinsically. Whether either
is intended decides the item; do those two first, with a browser check, and the
rest are the easy part.
