import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearReadCloudDisplay',
      displayName: 'Linked reads display',
      helpText:
        'Display paired-end and split read (supplementary read) alignments as linked entities. Note that the concept of "linked reads" is not specifically referring to Chromium 10x linked reads, this is just the general idea of linking paired-end, and split (supplementary) alignments',
      configSchema,
      stateModel: stateModelF(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      subDisplay: {
        type: 'LinearAlignmentsDisplay',
        lowerPanel: true,
      },
      ReactComponent: lazy(
        () => import('./components/LinearReadCloudReactComponent.tsx'),
      ),
    })
  })
}
