import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { configSchema } from './configSchema'
import { modelFactory } from './model'

export default (pluginManager: PluginManager) => {
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
