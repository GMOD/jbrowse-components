import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('HelpDrawerWidget', {})

export const stateModel = types.model('HelpDrawerWidget', {
  id: ElementId,
  type: types.literal('HelpDrawerWidget'),
})

export const ReactComponent = import('./components/HelpDrawerWidget')
