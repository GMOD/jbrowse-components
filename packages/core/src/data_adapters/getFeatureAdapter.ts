import { isFeatureAdapter } from './BaseAdapter/index.ts'
import { getAdapter } from './dataAdapterCache.ts'

import type PluginManager from '../PluginManager.ts'
import type { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'

/**
 * Resolve a feature data adapter and prime its reference-sequence adapter
 * config in one step — the shared prologue for every RPC that reads features
 * (getRefNames, feature fetch, feature details). Returns undefined when the
 * config resolves to a non-feature adapter, so callers decide how to degrade.
 */
export async function getFeatureAdapter({
  pluginManager,
  sessionId,
  adapterConfig,
  sequenceAdapter,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
}): Promise<BaseFeatureDataAdapter | undefined> {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const featureAdapter = isFeatureAdapter(dataAdapter) ? dataAdapter : undefined
  featureAdapter?.setSequenceAdapterConfig(sequenceAdapter)
  return featureAdapter
}
