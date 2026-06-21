/**
 * Index window for a virtualized 1-D axis: the visible span plus `overscan`
 * cells of buffer on each side, clamped to `[0, total]`. Shared by the row and
 * column axes of the MAF sequence grid so both stay in sync.
 */
export function virtualRange({
  scroll,
  cellSize,
  viewport,
  overscan,
  total,
}: {
  scroll: number
  cellSize: number
  viewport: number
  overscan: number
  total: number
}) {
  const start = Math.max(0, Math.floor(scroll / cellSize) - overscan)
  const visible = Math.ceil(viewport / cellSize) + overscan * 2
  const end = Math.min(total, start + visible)
  return { start, end }
}
