import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const { ReactComponent } = pluginManager.getDisplayType(
      'LinearAlignmentsDisplay',
    )
    return new DisplayType({
      name: 'LGVSyntenyDisplay',
      configSchema,
      // lazily loaded: this model builds on the alignments display model, so a
      // static edge here would pull that whole subgraph into the eager bundle
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
