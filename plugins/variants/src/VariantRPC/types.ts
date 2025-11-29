import type { Source } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
}

export interface GetGenotypeMatrixArgs extends BaseVariantRpcArgs {
  sources: Source[]
}

export interface GetSimplifiedFeaturesArgs extends BaseVariantRpcArgs {}

export interface ClusterGenotypeMatrixArgs extends BaseVariantRpcArgs {
  statusCallback: (arg: string) => void
  sources: Source[]
}
