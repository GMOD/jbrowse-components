import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { Source } from './util.ts'
import type { MultiRenderArgsDeserialized } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  name: string
}

export interface PerSourceFeatureCallback {
  (source: Source, features: Feature[]): void
}

/**
 * Gets sub-adapters from MultiWiggleAdapter and provides a way to iterate
 * over sources, fetching features one source at a time.
 * This reduces peak memory by only loading one source's features at a time.
 */
export async function getAdaptersForPerSourceRendering(
  pluginManager: PluginManager,
  renderProps: MultiRenderArgsDeserialized,
) {
  const { sessionId, adapterConfig } = renderProps
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const adapters: AdapterEntry[] = await (
    dataAdapter as BaseFeatureDataAdapter & {
      getAdapters(): Promise<AdapterEntry[]>
    }
  ).getAdapters()

  return new Map(adapters.map(a => [a.source, a.dataAdapter]))
}

/**
 * Iterates over sources, fetching and processing features one source at a time.
 * This reduces peak memory usage from O(all sources) to O(largest single source).
 */
export async function forEachSourceFeatures(
  adapterBySource: Map<string, BaseFeatureDataAdapter>,
  sources: Source[],
  region: Region,
  opts: Record<string, unknown>,
  callback: PerSourceFeatureCallback,
) {
  for (const source of sources) {
    const subAdapter = adapterBySource.get(source.name)
    if (subAdapter) {
      const features = await firstValueFrom(
        subAdapter.getFeatures(region, opts).pipe(toArray()),
      )
      callback(source, features)
      // features array goes out of scope here, can be GC'd before next source
    }
  }
}
