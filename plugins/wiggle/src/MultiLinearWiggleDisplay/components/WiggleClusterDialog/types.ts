import type { Source } from '../../../util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ReducedModel {
  sourcesWithoutLayout?: Source[]
  layout?: Source[]
  adapterConfig: AnyConfigurationModel
  setLayout: (arg: Source[]) => void
}
