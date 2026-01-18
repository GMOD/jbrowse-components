import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('SequenceSearchWidget', {})

export default function SequenceSearchWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'SequenceSearchWidget',
      heading: 'Sequence search',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/SequenceSearchWidget.tsx'),
      ),
    })
  })
}
