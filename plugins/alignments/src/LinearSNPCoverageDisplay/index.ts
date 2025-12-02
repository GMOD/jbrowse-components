import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema'
import modelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearSNPCoverageDisplay',
      displayName: 'SNPCoverage display',
      helpText:
        'Display coverage histogram and SNP composition for each genomic position',
      configSchema,
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() =>
        import('@jbrowse/plugin-wiggle').then(m => ({
          default: m.LinearWiggleDisplayReactComponent,
        })),
      ),
    })
  })
}
