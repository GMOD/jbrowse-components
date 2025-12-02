import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { expandRegion } from '@jbrowse/core/pluggableElementTypes/renderers/util'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import { lazy } from 'react'

class DivSequenceRenderer extends FeatureRendererType {
  supportsSVG = true

  getExpandedRegion(region: Region) {
    return expandRegion(region, 3)
  }
}

export default function DivSequenceRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new DivSequenceRenderer({
        name: 'DivSequenceRenderer',
        ReactComponent: lazy(() => import('./components/DivSequenceRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
