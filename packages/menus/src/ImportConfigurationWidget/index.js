import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('ImportConfigurationWidget', {})

export const stateModel = types.model('ImportConfigurationWidget', {
  id: ElementId,
  type: types.literal('ImportConfigurationWidget'),
})

export const ReactComponent = import('./components/ImportConfigurationWidget')
