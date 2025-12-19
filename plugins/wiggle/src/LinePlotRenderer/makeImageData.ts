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

  const colorIsCallback = config.color?.isCallback
  if (!colorIsCallback && 'getFeaturesAsArrays' in dataAdapter) {
    const featureArrays = await (dataAdapter as any).getFeaturesAsArrays(
      region,
      renderProps,
    )
    if (featureArrays && featureArrays.starts.length > 0) {
      const { renderLinePlotArrays } = await import('./renderLinePlotArrays')
      return renderLinePlotArrays(renderProps, featureArrays)
    }
  }

  const features = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )
  const { renderLinePlot } = await import('./renderLinePlot')
  return renderLinePlot(renderProps, features)
}
