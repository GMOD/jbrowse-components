import type { SampleInfo, Source } from '../shared/types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Region } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx?: number
  minorAlleleFrequencyFilter: number
  // fraction of no-call genotypes above which a variant is hidden; 1 keeps all
  maxMissingnessFilter: number
  // jexl filters from the Edit filters dialog. On the wire this is a string[];
  // RpcMethodTypeWithFiltersAndRenameRegions rebuilds it into a chain in the
  // worker (and serializes the chain to string[] on the way out).
  filters?: SerializableFilterChain
}

export interface GetGenotypeMatrixArgs extends BaseVariantRpcArgs {
  sources: Source[]
  // Which matrix to build: 'phased' means one row per haplotype, which needs
  // per-sample ploidy from `sampleInfo`. Anything else means one row per sample.
  renderingMode?: string
  sampleInfo?: Record<string, SampleInfo>
}

// The payload is `GetGenotypeMatrixArgs` exactly — clustering adds nothing to
// what gets fetched. It existed as its own interface only to add a REQUIRED
// `statusCallback`, which made this the one method in the registry a caller had
// to hand a progress callback to; that belongs to the call (RpcHandles, where it
// is optional like everywhere else), so the helper takes it and the entry does
// not.
export type ClusterGenotypeMatrixArgs = GetGenotypeMatrixArgs

export interface GetCellDataArgs extends BaseVariantRpcArgs {
  // Which samples get rows, as a SET — never an order. The worker builds its own
  // canonical row list (see `buildCanonicalRows`), names it in `rowNames`, and
  // the client places those names against the rows it draws. Sent sorted so a
  // reorder, a regroup, or a clustering run leaves the cache key untouched and
  // re-uploads instead of re-downloading the VCF. `undefined` means "every
  // sample the data has", which is the common case; an explicit list is a
  // subtree filter or a layout that drops rows, both of which genuinely change
  // what has to be computed. Mirrors maf's `subtreeFilter`.
  sampleFilter?: string[]
  renderingMode: string
  referenceDrawingMode?: string
  // Optional per-feature cell color (jexl string or plain CSS color), evaluated
  // once per variant in the worker. Empty/undefined = default genotype coloring.
  featureColor?: string
  mode: 'regular' | 'matrix'
  displayedRegionIndices?: number[]
  /**
   * `resolvedByteLimit()`. Absent means the gate may not act, and the executor
   * then measures nothing.
   */
  byteLimit?: number
}

export interface MultiSampleVariantGetSourcesArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions?: Region[]
  bpPerPx?: number
}
