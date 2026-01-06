import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('AboutWidget', {})

const stateModel = types.model('AboutWidget', {
  id: ElementId,
  type: types.literal('AboutWidget'),
})

export default function AboutWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AboutWidget',
      heading: 'About',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/AboutWidget.tsx')),
    })
  })
}
