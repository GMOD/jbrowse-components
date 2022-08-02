import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('AboutWidget', {})

export const stateModel = types.model('AboutWidget', {
  id: ElementId,
  type: types.literal('AboutWidget'),
})
