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
}
