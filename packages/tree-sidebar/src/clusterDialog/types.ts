import type { ClusterMatrix } from '../clusterMatrix.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DialogProps } from '@mui/material'

/**
 * Everything a display has to say about clustering its rows. The dialog itself —
 * the auto/manual mode switch, the run/progress/stop lifecycle, the R script and
 * TSV downloads, the paste box, the linkage picker — is the same for every
 * clusterable display and lives in `ClusterDialog`.
 */
export interface ClusterDialogProps {
  // read only for isAlive (a run whose display went away has no dialog to report
  // into) and getContainingView (the region/zoom the exported matrix is keyed on)
  model: IAnyStateTreeNode
  handleClose: () => void
  title: string
  /** intro line above the auto/manual radios */
  description?: string
  maxWidth?: DialogProps['maxWidth']

  /** false disables "Run clustering" — the rows aren't loaded yet */
  canRun: boolean
  /**
   * The in-app clustering RPC, given a stop token and a status sink. Throw for
   * preconditions (uninitialized view, too few rows) so they land in the same
   * error state as an RPC failure — see `useClusterRun`.
   */
  run: (args: {
    stopToken: StopToken
    statusCallback: (arg: RpcStatus) => void
  }) => Promise<void>

  /** e.g. "genotype matrix" — names it in the loading message */
  matrixLabel: string
  /** e.g. "genotypes.tsv" */
  tsvFilename: string
  /**
   * Extra fetch-key pieces for the exported matrix, beyond the view region and
   * zoom the dialog adds itself. Null suppresses the fetch (nothing to export
   * yet).
   */
  matrixKey: readonly unknown[] | null
  fetchMatrix: () => Promise<ClusterMatrix>
  /**
   * Apply a 0-based row order pasted back from R. Throw to reject it — the
   * dialog stays open and reports the message, so the user can fix the paste.
   */
  applyOrder: (order: number[]) => void

  /** display-specific controls, shown under "advanced options" in both tabs */
  advancedOptions?: React.ReactNode
}
