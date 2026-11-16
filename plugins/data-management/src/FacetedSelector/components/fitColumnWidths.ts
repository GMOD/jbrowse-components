/**
 * Shrinks column widths to fit `available` px. Each column keeps up to
 * `floorWidth` of its natural width, and the room left over is shared in
 * proportion to how much more each column wants, so a long name column keeps
 * more than a medium adapter column instead of both being cut to one width.
 * When even the floors don't fit, the floors are kept and the table scrolls.
 */
export function fitColumnWidths(
  widths: Record<string, number>,
  available: number,
  floorWidth: number,
) {
  const entries = Object.entries(widths)
  const floors = entries.map(([, w]) => Math.min(w, floorWidth))
  const floorTotal = floors.reduce((a, b) => a + b, 0)
  const wantTotal = entries.reduce((a, [, w], i) => a + w - floors[i]!, 0)
  const share =
    wantTotal > 0
      ? Math.min(1, Math.max(0, (available - floorTotal) / wantTotal))
      : 1
  return Object.fromEntries(
    entries.map(([id, w], i) => [
      id,
      Math.floor(floors[i]! + (w - floors[i]!) * share),
    ]),
  )
}
