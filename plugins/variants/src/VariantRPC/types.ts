import type { ProcessedSource, SampleInfo, Source } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, StopToken } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx?: number
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
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

export interface GetLDMatrixArgs extends BaseVariantRpcArgs {
  ldMetric?: 'r2' | 'dprime'
}

export interface GetCellDataArgs extends BaseVariantRpcArgs {
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode?: string
  mode: 'regular' | 'matrix'
  displayedRegionIndices?: number[]
  statusCallback: (arg: string) => void
  byteSizeLimit?: number
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
