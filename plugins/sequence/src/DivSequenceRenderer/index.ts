import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { expandRegion } from '@jbrowse/core/pluggableElementTypes/renderers/util'

import ReactComponent from './components/DivSequenceRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  RenderArgsDeserialized,
  RenderResults,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Region } from '@jbrowse/core/util/types'

class DivSequenceRenderer extends FeatureRendererType {
  supportsSVG = true

  getExpandedRegion(region: Region) {
    return expandRegion(region, 3)
  }

  async render(renderArgs: RenderArgsDeserialized): Promise<RenderResults> {
    const features = await this.getFeatures(renderArgs)
    const result = await super.render({ ...renderArgs, features })
    return { ...result, features }
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
