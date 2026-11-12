import type { ClusterMatrix } from '../clusterMatrix.ts'
import type { Region, RpcCaller, RpcStatus } from '@jbrowse/core/util'
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
  signal: AbortSignal
  statusCallback: (arg: RpcStatus) => void
}

/**
 * The display a dialog clusters: an R order pasted back indexes
 * `clusterableSources` and lands through `setRowOrder`, as a run's does.
 */
export interface ClusterDialogModel<
  S extends { name: string },
> extends IStateTreeNode {
  clusterableSources: S[]
  editableSources: S[]
  setRowOrder: (rows: S[]) => void
}

/**
 * Everything a display has to say about clustering its rows. The dialog itself —
 * the auto/manual mode switch, the run/progress/stop lifecycle, the R script and
 * TSV downloads, the paste box, the linkage picker — is the same for every
 * clusterable display and lives in `ClusterDialog`.
 */
export interface ClusterDialogProps<S extends { name: string }> {
  model: ClusterDialogModel<S>
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

  /** display-specific controls, shown under "advanced options" in both tabs */
  advancedOptions?: React.ReactNode
}
