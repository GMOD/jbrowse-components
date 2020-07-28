import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('HelpWidget', {})

export const stateModel = types.model('HelpWidget', {
  id: ElementId,
  type: types.literal('HelpWidget'),
})

export { default as ReactComponent } from './components/HelpWidget'
