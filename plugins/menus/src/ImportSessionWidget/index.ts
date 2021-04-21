import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('ImportSessionWidget', {})

export const stateModel = types.model('ImportSessionWidget', {
  id: ElementId,
  type: types.literal('ImportSessionWidget'),
})
