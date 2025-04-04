import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

export const configSchema = ConfigurationSchema('SessionManager', {})

export const stateModel = types.model('SessionManager', {
  id: ElementId,
  type: types.literal('SessionManager'),
})

export default function SessionManagerF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'SessionManager',
      heading: 'Recent sessions',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/SessionManager')),
    })
  })
}
