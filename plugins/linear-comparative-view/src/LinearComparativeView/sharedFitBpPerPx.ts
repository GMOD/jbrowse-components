// A row of a stack, as far as the shared scale is concerned.
interface FitRow {
  initialized: boolean
  fitBpPerPx: number
}

/**
 * The one bp/px every row is held at while `sameScale` is on: one scale has to
 * fit the LARGEST genome, so it is the coarsest of the rows' own fits. Zero —
 * each row answers to its own fit — whenever it cannot be answered.
 *
 * Three ways it cannot be answered, and none of them is a formality:
 *
 * - The mode is off.
 * - No rows. `Math.max()` of nothing is `-Infinity`, and as a zoom-out ceiling
 *   that is a row which can never zoom out at all.
 * - Any row not `initialized`. `fitBpPerPx` reads `width`, which THROWS while
 *   `volatileWidth` is undefined, and this is read from an autorun that runs at
 *   attach — before the sibling width autorun has anything to push, which is
 *   how a restored `sameScale: true` session came up with an uncaught MobX
 *   reaction error. A row with width but no regions is the quiet half of the
 *   same problem: it answers 1, and one unloaded row would hold the whole stack
 *   at a scale ten times too fine.
 *
 * `every` short-circuits, so an early uninitialized row leaves the later rows
 * unread and untracked — which converges anyway, because the row that WAS read
 * is the one whose flip re-runs this and reads the next.
 */
export function sharedFitBpPerPx(rows: FitRow[], sameScale: boolean) {
  return sameScale && rows.length > 0 && rows.every(r => r.initialized)
    ? Math.max(...rows.map(r => r.fitBpPerPx))
    : 0
}
