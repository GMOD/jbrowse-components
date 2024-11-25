import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import ReactComponent from './components/DivSequenceRendering'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'

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

export default function DivSequenceRendererF(pluginManager: PluginManager) {
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
