import { DEFAULT_COL_WIDTH } from './tableStyles.ts'

const NAME_SHARE = 0.5

/**
 * The least of its natural width a column keeps when columns are fitted: the
 * name keeps up to half the room, since it is what tells tracks apart, and
 * every other column up to {@link DEFAULT_COL_WIDTH}.
 */
export function columnFloor(id: string, available: number) {
  return id === 'name'
    ? Math.max(DEFAULT_COL_WIDTH, available * NAME_SHARE)
    : DEFAULT_COL_WIDTH
}

/**
 * How many columns fit beside a name column of natural width `nameWidth` in
 * `available` px, each at its floor.
 */
export function columnsThatFit(available: number, nameWidth: number) {
  return Math.max(
    0,
    Math.floor(
      (available - Math.min(nameWidth, columnFloor('name', available))) /
        DEFAULT_COL_WIDTH,
    ),
  )
}

/**
 * Shrinks column widths to fit `available` px. Each column keeps up to its
 * floor of its natural width, and the room left over is shared in proportion
 * to how much more each column wants, so a long column keeps more than a
 * medium one instead of both being cut to one width. When even the floors
 * don't fit, the floors are kept and the table scrolls. Room left once every
 * column has its natural width goes to the first column, the name.
 */
export function fitColumnWidths(
  widths: Record<string, number>,
  available: number,
  floorFor: (id: string) => number,
) {
  const entries = Object.entries(widths)
  const floors = entries.map(([id, w]) => Math.min(w, floorFor(id)))
  const floorTotal = floors.reduce((a, b) => a + b, 0)
  const wantTotal = entries.reduce((a, [, w], i) => a + w - floors[i]!, 0)
  const share =
    wantTotal > 0
      ? Math.min(1, Math.max(0, (available - floorTotal) / wantTotal))
      : 1
  const fitted = entries.map(([, w], i) =>
    Math.floor(floors[i]! + (w - floors[i]!) * share),
  )
  const slack =
    share === 1 ? Math.max(0, available - fitted.reduce((a, b) => a + b, 0)) : 0
  return Object.fromEntries(
    entries.map(([id], i) => [id, fitted[i]! + (i === 0 ? slack : 0)]),
  )
}
