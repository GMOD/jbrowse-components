import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { RenderArgsDeserialized } from '../types'

export default class DensityRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { sessionId, adapterConfig, regions } = renderProps
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const region = regions[0]!

    // Use array-based rendering when the adapter supports it
    if ('getFeaturesAsArrays' in dataAdapter) {
      const featureArrays = await (dataAdapter as any).getFeaturesAsArrays(
        region,
        renderProps,
      )
      if (featureArrays && featureArrays.starts.length > 0) {
        const { renderDensityArrays } = await import('./renderDensityArrays')
        return renderDensityArrays(renderProps, featureArrays)
      }
    }

    // Fallback to feature-based rendering
    const features = await this.getFeatures(renderProps)
    const { renderDensity } = await import('./renderDensity')
    return renderDensity(renderProps, features)
  }
}
