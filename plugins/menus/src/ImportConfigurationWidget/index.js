import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('ImportConfigurationWidget', {})

export const stateModel = types.model('ImportConfigurationWidget', {
  id: ElementId,
  type: types.literal('ImportConfigurationWidget'),
})

export { default as ReactComponent } from './components/ImportConfigurationWidget'
