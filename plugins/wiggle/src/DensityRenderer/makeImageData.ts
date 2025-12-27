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

  const features = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )
  const { renderDensity } = await import('./renderDensity')
  return renderDensity(renderProps, features)
}
