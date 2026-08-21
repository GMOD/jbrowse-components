import type { SharedFit } from '@jbrowse/plugin-linear-genome-view'

interface FitRow {
  initialized: boolean
  fitBpPerPx: number
}

/**
 * The one bp/px every row is held at while `sameScale` is on: one scale has to
 * fit the LARGEST genome, so it is the coarsest of the rows' own fits. Rows
 * pull it back through `maxBpPerPx`, making it a limit rather than a value
 * written past one.
 *
 * Unanswered is not zero. `fitBpPerPx` reads `width`, which throws before the
 * first layout, and an empty stack gives `Math.max()` of nothing — -Infinity,
 * which as a ceiling is a row that can never zoom out. Zero is the live answer
 * for "mode off", so collapsing the two would read a row mid-layout as a
 * request to release the stack, and the clamp that follows is one-way: it drags
 * every row down to its own fit, where restoring the ceiling cannot lift them.
 *
 * `every` short-circuits, leaving later rows unread and untracked — which
 * converges anyway, since the row that WAS read is the one whose flip re-runs
 * this.
 */
export function sharedFit(rows: FitRow[], sameScale: boolean): SharedFit {
  return sameScale
    ? rows.length > 0 && rows.every(r => r.initialized)
      ? { answered: true, bpPerPx: Math.max(...rows.map(r => r.fitBpPerPx)) }
      : { answered: false }
    : { answered: true, bpPerPx: 0 }
}
