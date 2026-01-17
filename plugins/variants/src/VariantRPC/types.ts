import type { Source } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, StopToken } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
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

export type GetSimplifiedFeaturesArgs = BaseVariantRpcArgs

export interface ClusterGenotypeMatrixArgs extends BaseVariantRpcArgs {
  statusCallback: (arg: string) => void
  sources: Source[]
}

export type GetLDMatrixArgs = BaseVariantRpcArgs
