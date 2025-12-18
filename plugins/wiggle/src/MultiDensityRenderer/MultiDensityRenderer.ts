import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiDensityPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const { sessionId, adapterConfig, regions } = renderProps
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const region = regions[0]!

    // Try array-based rendering for better performance
    if ('getFeaturesAsArrays' in dataAdapter) {
      const arraysBySource = await (dataAdapter as any).getFeaturesAsArrays(
        region,
        renderProps,
      )
      const allSourcesHaveArrays = renderProps.sources.every(
        s => arraysBySource[s.name],
      )
      if (allSourcesHaveArrays) {
        const { renderMultiDensityArrays } =
          await import('./renderMultiDensityArrays')
        return renderMultiDensityArrays(renderProps, arraysBySource)
      }
    }

    // Fallback to feature-based rendering
    const features = await this.getFeatures(renderProps)
    const { renderMultiDensity } = await import('./renderMultiDensity')
    return renderMultiDensity(renderProps, features)
  }
}
