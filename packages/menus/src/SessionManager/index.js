import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('SessionManager', {})

export const stateModel = types.model('SessionManager', {
  id: ElementId,
  type: types.literal('SessionManager'),
})

export { default as ReactComponent } from './components/SessionManager'
