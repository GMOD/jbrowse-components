import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema(
  'ImportConfigurationDrawerWidget',
  {},
)

export const stateModel = types.model('ImportConfigurationDrawerWidget', {
  id: ElementId,
  type: types.literal('ImportConfigurationDrawerWidget'),
})

export const ReactComponent = import(
  './components/ImportConfigurationDrawerWidget'
)
