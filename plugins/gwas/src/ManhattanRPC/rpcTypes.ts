import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface GetManhattanDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  // CSS color literal or jexl expression (`jexl:...`). Evaluated per feature
  // on the worker — the result baked into ManhattanRpcResult.colors[]. Used in
  // 'normal' coloring mode.
  color: string
  // 'ld' colors each point by its r² to `indexSnp`, read from `ldAdapterConfig`
  // (a PLINK .ld adapter). 'normal' uses `color`.
  colorBy: 'normal' | 'ld'
  // Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string.
  indexSnp?: string
  // PLINK .ld adapter config snapshot resolved on the worker for LD coloring.
  ldAdapterConfig?: Record<string, unknown>
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

// One region's worth of GWAS points. Flat by design — GWAS doesn't bin or
// split by sign like wiggle does.
export interface ManhattanRpcResult {
  positions: Uint32Array
  scores: Float32Array
  // Per-feature ABGR colors (uint32). Always populated, even when the user's
  // color config is a literal string — the executor resolves to ABGR
  // uniformly so renderers don't need to branch.
  colors: Uint32Array
  numFeatures: number
  scoreMin: number
  scoreMax: number
  // Flatbush 2D R-tree index over (bp, score) for hit testing — built on the
  // worker, transferred zero-copy, wrapped on demand via Flatbush.from. Empty
  // when numFeatures === 0 (Flatbush rejects zero-item indexes).
  flatbushData: ArrayBuffer | undefined
}
