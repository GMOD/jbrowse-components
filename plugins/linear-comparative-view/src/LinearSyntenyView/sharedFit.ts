import type { SharedFit } from '@jbrowse/plugin-linear-genome-view'

interface FitRow {
  initialized: boolean
  error: unknown
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
 * A row whose assembly failed never initializes, so it is left out rather than
 * holding the stack unanswered for good: unanswered lets every other row fall
 * back to its own fit, and the one-way clamp then loses the shared scale until
 * the failed row is removed. A stack of only failed rows has no answer.
 */
export function sharedFit(rows: FitRow[], sameScale: boolean): SharedFit {
  if (!sameScale) {
    return { answered: true, bpPerPx: 0 }
  }
  const live = rows.filter(r => !r.error)
  return live.length > 0 && live.every(r => r.initialized)
    ? { answered: true, bpPerPx: Math.max(...live.map(r => r.fitBpPerPx)) }
    : { answered: false }
}
