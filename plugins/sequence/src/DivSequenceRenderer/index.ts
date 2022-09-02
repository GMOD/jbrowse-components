import PluginManager from '@jbrowse/core/PluginManager'

import { Region } from '@jbrowse/core/util/types'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import ReactComponent from './components/DivSequenceRendering'
import configSchema from './configSchema'

/* adjust in both directions */
class DivSequenceRenderer extends FeatureRendererType {
  supportsSVG = true

  getExpandedRegion(region: Region) {
    return {
      ...region,
      start: Math.max(region.start - 3, 0),
      end: region.end + 3,
    }
  }
}

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new DivSequenceRenderer({
        name: 'DivSequenceRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
