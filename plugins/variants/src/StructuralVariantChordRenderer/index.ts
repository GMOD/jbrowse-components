import { lazy } from 'react'

import ChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function StructuralVariantChordRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(
    () =>
      new ChordRendererType({
        name: 'StructuralVariantChordRenderer',
        displayName: 'SV chord renderer',
        ReactComponent: lazy(() => import('./ReactComponent')),
        configSchema,
        pluginManager,
      }),
  )
}
