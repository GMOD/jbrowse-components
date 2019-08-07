import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('SessionManager', {})

export const stateModel = types.model('SessionManager', {
  id: ElementId,
  type: types.literal('SessionManager'),
})

export const ReactComponent = import('./components/SessionManager')
