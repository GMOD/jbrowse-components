import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { RenderArgsDeserialized } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function makeImageData(
  renderProps: RenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { sessionId, adapterConfig, regions, config } = renderProps
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const region = regions[0]!

  // Use array-based rendering when:
  // 1. The adapter supports getFeaturesAsArrays
  // 2. The color is NOT a callback (jexl expression)
  const colorIsCallback = config.color?.isCallback
  if (!colorIsCallback && 'getFeaturesAsArrays' in dataAdapter) {
    const featureArrays = await (dataAdapter as any).getFeaturesAsArrays(
      region,
      renderProps,
    )
    const { renderXYPlotArrays } = await import('./renderXYPlotArrays')
    return renderXYPlotArrays(renderProps, featureArrays)
  } else {
    // Fallback to feature-based rendering
    const features = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeatures(region, renderProps)
        .pipe(toArray()),
    )

    const { renderXYPlot } = await import('./renderXYPlot')
    return renderXYPlot(renderProps, features)
  }
}
