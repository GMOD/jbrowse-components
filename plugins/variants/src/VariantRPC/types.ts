import type { Source } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

export interface GetGenotypeMatrixArgs {
  sources: Source[]
  minorAlleleFrequencyFilter: number
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  lengthCutoffFilter: number
}

export interface GetSimplifiedFeaturesArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
}

export interface ClusterGenotypeMatrixArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  statusCallback: (arg: string) => void
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
}
