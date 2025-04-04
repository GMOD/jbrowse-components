import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('HelpWidget', {})

const stateModel = types.model('HelpWidget', {
  id: ElementId,
  type: types.literal('HelpWidget'),
})

export default function HelpWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'HelpWidget',
      heading: 'Help',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/HelpWidget')),
    })
  })
}
