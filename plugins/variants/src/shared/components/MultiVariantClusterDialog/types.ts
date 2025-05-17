import type { Source } from '../../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ReducedModel {
  sourcesWithoutLayout?: Source[]
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter: number
  adapterConfig: AnyConfigurationModel
  setLayout: (arg: Source[]) => void
  clearLayout: () => void
}
