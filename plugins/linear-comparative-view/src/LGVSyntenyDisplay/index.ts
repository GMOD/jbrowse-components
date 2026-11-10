import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'
import { LGV_SYNTENY_PLOT_EXAMPLES } from './plotExamples.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF()
    // v4.3.0 built this display on the pileup mixin, so its sessions carry
    // the colorBySetting and filterBySetting the alignments display lifts
    const { ReactComponent, retiredState } = pluginManager.getDisplayType(
      'LinearAlignmentsDisplay',
    )
    return new DisplayType({
      name: 'LGVSyntenyDisplay',
      displayName: 'Synteny alignments display',
      configSchema,
      // lazily loaded: this model builds on the alignments display model, so a
      // static edge here would pull that whole subgraph into the eager bundle
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'SyntenyTrack',
      rpcMethods: ['RenderAlignmentData'],
      viewType: 'LinearGenomeView',
      plotExamples: LGV_SYNTENY_PLOT_EXAMPLES,
      ReactComponent,
      retiredState,
    })
  })
}
