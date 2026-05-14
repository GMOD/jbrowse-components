import { lazy } from 'react'

import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'

import MafSequenceHoverHighlightExtensionF from './MafSequenceHoverHighlightExtension'
import { configSchema } from './configSchema'
import { stateModelFactory } from './stateModelFactory'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafSequenceWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'MafSequenceWidget',
        heading: 'MAF Sequence',
        configSchema,
        stateModel: stateModelFactory(),
        ReactComponent: lazy(() => import('./MafSequenceWidget')),
      }),
  )

  MafSequenceHoverHighlightExtensionF(pluginManager)
}
