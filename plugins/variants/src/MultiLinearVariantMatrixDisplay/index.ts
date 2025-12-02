import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema'
import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

export default function LinearVariantMatrixDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearVariantMatrixDisplay',
      displayName: 'Multi-sample variant display (matrix)',
      helpText:
        'Draws multi-sample variant using a "matrix" where the visualization does not correspond to actual base pair coordinates, but uses lines to connect the columns of the matrix to their base pair coordinates',

      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(
        () => import('./components/VariantDisplayComponent'),
      ),
    })
  })
}
