import type { Source } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ReducedModel {
  sourcesWithoutLayout?: Source[]
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter: number
  adapterConfig: AnyConfigurationModel
  setClusterTree: (arg?: string) => void
  setLayout: (arg: Source[], clearTree?: boolean) => void
  clearLayout: () => void
}
