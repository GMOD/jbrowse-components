import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

// locals
import configSchemaFactory from './configSchema'
import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearSNPCoverageDisplay',
      displayName: 'SNPCoverage display',
      configSchema,
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
