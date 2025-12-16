import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { RenderArgsDeserialized } from '../types'

export default class XYPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { sessionId, adapterConfig, regions, config } = renderProps
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const region = regions[0]!

    // Use array-based rendering when:
    // 1. The adapter supports getFeaturesAsArrays
    // 2. The color is NOT a callback (jexl expression)
    const colorIsCallback = config?.color?.isCallback
    if (!colorIsCallback && 'getFeaturesAsArrays' in dataAdapter) {
      const featureArrays = await (dataAdapter as any).getFeaturesAsArrays(
        region,
        renderProps,
      )
      if (featureArrays && featureArrays.starts.length > 0) {
        const { renderXYPlotArrays } = await import('./renderXYPlotArrays')
        return renderXYPlotArrays(renderProps, featureArrays)
      }
    }

    // Fallback to feature-based rendering
    const features = await this.getFeatures(renderProps)
    const { renderXYPlot } = await import('./renderXYPlot')
    return renderXYPlot(renderProps, features)
  }
}
