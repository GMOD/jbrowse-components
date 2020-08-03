import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('AboutWidget', {})

export const stateModel = types.model('AboutWidget', {
  id: ElementId,
  type: types.literal('AboutWidget'),
})

export { default as ReactComponent } from './components/AboutWidget'
