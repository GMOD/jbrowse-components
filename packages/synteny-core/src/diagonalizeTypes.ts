import type { StatusCallback } from '@jbrowse/core/util'

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
  /**
   * Row the sweep starts from, and the one row it leaves alone: rows below it
   * are ordered against the row above them, rows above it against the row
   * below. Defaults to the top row, which is the plain top-down cascade.
   *
   * It matters wherever the top row is not the one whose order means
   * something: `linkage_groups/alg_stack` stacks six genomes whose linkage
   * groups are the jellyfish row's chromosomes, and anchored on the top row
   * every row below is ordered off a comb jelly instead.
   */
  anchorRow?: number
  signal?: AbortSignal
  statusCallback?: StatusCallback
  /**
   * Called with the running totals each time a reordering has been applied to
   * the view. The synteny cascade commits level by level — level i+1
   * diagonalizes against the row level i just reordered, so it cannot wait for
   * the whole stack — which means stopping mid-run leaves the stack partly
   * reordered. The callback lets the dialog report that partial reorder
   * rather than close without mentioning it. Single-pass runners (the dotplot's) apply once at the
   * end and so only ever call it on success.
   */
  onProgress?: (stats: DiagonalizeStats) => void
}
