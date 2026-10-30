// A row stack's edges on the device pixel grid, for a display whose rows tile.
// Rows meeting mid-pixel and antialiased each cover part of the pixel, and
// composited OVER they let the background through; a Canvas2D fillRect at
// fractional y seams the same way. Snapped, every pixel belongs to one row on
// every backend, at one sample.
//
// `dpr` is the backing store's own y scale (`clip.scaleY` on the GPU,
// `backingScale(canvasHeight)` on the CPU), so the edges land on its pixel
// boundaries even where it departs from `getDpr()`.
//! js-export: snappedRowTopPx, snappedRowBottomPx
module rowSnap;

// The top of row `row` in a stack scrolled by `scrollTop`.
public float snappedRowTopPx(float row, float rowHeight, float scrollTop, float dpr) {
  return floor((row * rowHeight - scrollTop) * dpr + 0.5) / dpr;
}

// The bottom of a band `drawnHeightPx` tall hung from row `row`'s top. A band
// one row tall ends exactly on the next row's snapped top, so the rows tile,
// and every band keeps at least one device pixel.
public float snappedRowBottomPx(
  float row, float rowHeight, float drawnHeightPx, float scrollTop, float dpr
) {
  float bottom = snappedRowTopPx(
    row + drawnHeightPx / rowHeight, rowHeight, scrollTop, dpr);
  return max(bottom, snappedRowTopPx(row, rowHeight, scrollTop, dpr) + 1.0 / dpr);
}
