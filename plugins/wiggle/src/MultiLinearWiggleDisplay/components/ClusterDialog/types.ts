import type { Source } from '../../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ReducedModel {
  sourcesWithoutLayout?: Source[]
  adapterConfig: AnyConfigurationModel
  setLayout: (arg: Source[]) => void
}
