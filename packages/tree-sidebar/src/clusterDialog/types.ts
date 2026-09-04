import type { ClusterMatrix } from '../clusterMatrix.ts'
import type { Region, RpcCaller, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DialogProps } from '@mui/material'

/**
 * Everything a clustering run needs to make its RPC call, resolved by the
 * dialog and handed down — the same object `setupRunClusteringAutorun` hands
 * its `run`, so a display writes its run ONCE and both entry points call it.
 *
 * `regions` is the visible blocks here (the autorun's is the `clusterRegion`
 * locus when a session named one). `rpcManager` / `sessionId` are resolved here
 * for the reason the autorun resolves them: every dialog opened with the
 * identical `getRpcHost(self).rpcManager` + `getRpcSessionId(self)` pair, and
 * resolving them once means a flavor cannot reach for a different session id
 * and land its RPC on another worker's adapter cache.
 */
export interface ClusterRunArgs {
  rpcManager: RpcCaller
  sessionId: string
  regions: Region[]
  stopToken: StopToken
  statusCallback: (arg: RpcStatus) => void
}

/**
 * Everything a display has to say about clustering its rows. The dialog itself —
 * the auto/manual mode switch, the run/progress/stop lifecycle, the R script and
 * TSV downloads, the paste box, the linkage picker — is the same for every
 * clusterable display and lives in `ClusterDialog`.
 */
export interface ClusterDialogProps {
  // read for isAlive (a run whose display went away has no dialog to report
  // into), for getContainingView (the region/zoom the exported matrix is keyed
  // on, and the blocks a run covers) and for the RPC host
  model: IStateTreeNode
  handleClose: () => void
  title: string
  /** intro line above the auto/manual radios */
  description?: string
  maxWidth?: DialogProps['maxWidth']

  /** false disables "Run clustering" — the rows aren't loaded yet */
  canRun: boolean
  /**
   * The in-app clustering RPC. Throw for preconditions (too few rows) so they
   * land in the same error state as an RPC failure — see `useClusterRun`; an
   * uninitialized view is thrown for you before this is called.
   */
  run: (args: ClusterRunArgs) => Promise<void>

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
  /**
   * The exported matrix, given the same resolved args as `run`: this is the
   * *same* work the auto tab does, differing only in the clustering step.
   * Declared here rather than left to the caller because `useFetch`'s trailing
   * handles are positional, so a zero-parameter fetcher is assignable and
   * simply never sees them — which is how both plugins lost cancel and progress
   * on this tab while complying with the interface.
   */
  fetchMatrix: (args: ClusterRunArgs) => Promise<ClusterMatrix>
  /**
   * Apply a 0-based row order pasted back from R. Throw to reject it — the
   * dialog stays open and reports the message, so the user can fix the paste.
   *
   * `matrixRowNames` is the row list the matrix the user exported was built
   * over, in the order the R script wrote into `rownames`, or undefined when
   * nothing was exported from this dialog. Hand it to `validateClusterOrder`
   * along with the rows the order is about to be applied to: the two disagree
   * whenever the row set moved during the trip to R, and a count check alone
   * cannot see it. Only the display knows which rows those are — in phased mode
   * the matrix is haplotypes and the display's own list is samples.
   */
  applyOrder: (order: number[], matrixRowNames?: string[]) => void

  /** display-specific controls, shown under "advanced options" in both tabs */
  advancedOptions?: React.ReactNode
}
