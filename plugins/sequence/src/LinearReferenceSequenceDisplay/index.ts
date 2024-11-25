import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { configSchema } from './configSchema'
import { modelFactory } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearReferenceSequenceDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const stateModel = modelFactory(configSchema)
    return new DisplayType({
      name: 'LinearReferenceSequenceDisplay',
      configSchema,
      stateModel,
      displayName: 'Reference sequence display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
