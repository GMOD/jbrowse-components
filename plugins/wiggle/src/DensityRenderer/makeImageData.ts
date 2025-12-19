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
  const { sessionId, adapterConfig, regions } = renderProps
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const region = regions[0]!

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

  const features = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )
  const { renderDensity } = await import('./renderDensity')
  return renderDensity(renderProps, features)
}
