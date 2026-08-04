import type { SampleInfo, Source } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Region, RpcStatus, StopToken } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
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

export interface ClusterGenotypeMatrixArgs extends GetGenotypeMatrixArgs {
  statusCallback: (status: RpcStatus) => void
}

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
  statusCallback: (status: RpcStatus) => void
}

export interface MultiSampleVariantGetSourcesArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
  headers?: Record<string, string>
  regions?: Region[]
  bpPerPx?: number
  statusCallback?: (status: RpcStatus) => void
}
