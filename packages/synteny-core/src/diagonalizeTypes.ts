import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/** What a reorder pass changed, for the progress dialog's summary line. */
export interface DiagonalizeStats {
  totalReordered: number
  totalReversed: number
}

/**
 * Cancellation + progress plumbing every reorder runner accepts, so the manual
 * dialog and the auto-diagonalize path can drive either view's runner.
 */
export interface DiagonalizeRunOpts {
  stopToken?: StopToken
  statusCallback?: StatusCallback
  /**
   * Called with the running totals each time a reordering has been applied to
   * the view. The synteny cascade commits level by level — level i+1
   * diagonalizes against the row level i just reordered, so it cannot wait for
   * the whole stack — which means stopping mid-run leaves the stack partly
   * reordered. This is what lets the dialog say so rather than close on a
   * silent half-state. Single-pass runners (the dotplot's) apply once at the
   * end and so only ever call it on success.
   */
  onProgress?: (stats: DiagonalizeStats) => void
}
