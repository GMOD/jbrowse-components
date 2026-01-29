import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { Source } from './util.ts'
import type { MultiRenderArgsDeserialized } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
}

/**
 * Iterates over sources, fetching and processing features one source at a time.
 * This reduces peak memory usage from O(all sources) to O(largest single source).
 */
export async function forEachSourceFeatures(
  pluginManager: PluginManager,
  renderProps: MultiRenderArgsDeserialized,
  callback: (source: Source, features: Feature[]) => void,
) {
  const { sessionId, adapterConfig, sources, regions } = renderProps
  const { dataAdapter } = await getAdapter(pluginManager, sessionId, adapterConfig)

  const adapters: AdapterEntry[] = await (
    dataAdapter as BaseFeatureDataAdapter & {
      getAdapters(): Promise<AdapterEntry[]>
    }
  ).getAdapters()

  const adapterBySource = new Map(adapters.map(a => [a.source, a.dataAdapter]))
  const region = regions[0]!

  for (const source of sources) {
    const subAdapter = adapterBySource.get(source.name)
    if (subAdapter) {
      const features = await firstValueFrom(
        subAdapter.getFeatures(region, renderProps).pipe(toArray()),
      )
      callback(source, features)
    }
  }
}
