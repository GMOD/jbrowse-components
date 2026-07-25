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
}
