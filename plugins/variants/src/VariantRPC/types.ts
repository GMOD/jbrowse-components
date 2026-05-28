import type { ProcessedSource, SampleInfo, Source } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Region, StopToken } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx?: number
  minorAlleleFrequencyFilter: number
  // jexl filters from the Edit filters dialog. On the wire this is a string[];
  // RpcMethodTypeWithFiltersAndRenameRegions rebuilds it into a chain in the
  // worker (and serializes the chain to string[] on the way out).
  filters?: SerializableFilterChain
}

export interface GetGenotypeMatrixArgs extends BaseVariantRpcArgs {
  sources: Source[]
}

export interface ClusterGenotypeMatrixArgs extends BaseVariantRpcArgs {
  statusCallback: (arg: string) => void
  sources: Source[]
  renderingMode?: string
  sampleInfo?: Record<string, SampleInfo>
}

export interface GetCellDataArgs extends BaseVariantRpcArgs {
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode?: string
  mode: 'regular' | 'matrix'
  displayedRegionIndices?: number[]
  statusCallback: (arg: string) => void
}

export interface MultiSampleVariantGetSourcesArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
  headers?: Record<string, string>
  regions?: Region[]
  bpPerPx?: number
  statusCallback?: (arg: string) => void
}
