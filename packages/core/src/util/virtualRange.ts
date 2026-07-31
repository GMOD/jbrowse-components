/**
 * Index window for a virtualized 1-D axis of uniform cells: the `[start, end)`
 * range covering the visible span plus `overscan` cells of buffer on each side,
 * clamped to `[0, total]`.
 *
 * `end` is anchored to `start` (a fixed cell count) rather than recomputed from
 * `scroll + viewport`. That makes the window **stable across sub-cell scrolling**
 * — it only moves when `start` crosses a cell boundary — which is what lets
 * consumers skip work on most scroll events: a canvas keeps its size and
 * contents, a DOM list keeps its rows mounted. Recomputing `end` independently
 * is tighter by up to `overscan` cells at the origin and costs that stability,
 * which is the wrong trade for both.
 *
 * `start` is clamped to `total`, not just to 0. A list that shrinks while its
 * container keeps its scroll position (a new region or track arriving under a
 * scrolled grid) otherwise yields `start > end` — an inverted range whose
 * consumers compute a negative canvas height and paint nothing until the next
 * scroll event. The faceted selector had already hit that and clamped for it;
 * the MAF sequence grid had the same math without the clamp, which is what
 * brought the two together here.
 */
export function virtualRange({
  scroll,
  cellSize,
  viewport,
  overscan,
  total,
}: {
  /** scroll offset of the container, in px */
  scroll: number
  /** px size of one cell along this axis */
  cellSize: number
  /** px size of the visible span */
  viewport: number
  /** cells of buffer to render beyond each edge */
  overscan: number
  /** total number of cells on this axis */
  total: number
}) {
  const start = Math.min(
    total,
    Math.max(0, Math.floor(scroll / cellSize) - overscan),
  )
  const visible = Math.ceil(viewport / cellSize) + overscan * 2
  return { start, end: Math.min(total, start + visible) }
}
