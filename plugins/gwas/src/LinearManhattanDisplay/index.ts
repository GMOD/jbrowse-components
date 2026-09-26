import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { LinearMarkDisplayReactComponent } from '@jbrowse/plugin-marks'

import { configSchemaFactory } from './configSchemaFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearManhattanDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearManhattanDisplay',
      displayName: 'Manhattan plot display',
      configSchema,
      stateModel: () =>
        import('./stateModelFactory.ts').then(f =>
          f.stateModelFactory(pluginManager, configSchema),
        ),
      trackType: ['GWASTrack', 'FeatureTrack'],
      viewType: 'LinearGenomeView',
      ReactComponent: LinearMarkDisplayReactComponent,
    })
  })
}
