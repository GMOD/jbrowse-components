import { lazy } from 'react'

import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'

import MafSequenceHoverHighlightExtensionF from './MafSequenceHoverHighlightExtension.tsx'
import { configSchema } from './configSchema.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafSequenceWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'MafSequenceWidget',
        heading: 'MAF Sequence',
        configSchema,
        stateModel: stateModelFactory(),
        ReactComponent: lazy(() => import('./MafSequenceWidget.tsx')),
      }),
  )

  MafSequenceHoverHighlightExtensionF(pluginManager)
}
