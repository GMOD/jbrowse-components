import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('AboutDrawerWidget', {})

export const stateModel = types.model('AboutDrawerWidget', {
  id: ElementId,
  type: types.literal('AboutDrawerWidget'),
})

export const ReactComponent = import('./components/AboutDrawerWidget')
