import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const AlignmentsDisplayComponent = lazy(
  () =>
    import('@jbrowse/plugin-alignments/src/LinearAlignmentsDisplay/components/AlignmentsDisplayComponent.tsx'),
)

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      name: 'LGVSyntenyDisplay',
      configSchema,
      stateModel,
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: AlignmentsDisplayComponent,
    })
  })
}
