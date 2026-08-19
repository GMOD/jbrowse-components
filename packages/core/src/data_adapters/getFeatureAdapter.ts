import { isFeatureAdapter } from './BaseAdapter/index.ts'
import { getAdapter } from './dataAdapterCache.ts'

import type PluginManager from '../PluginManager.ts'
import type { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'

export interface GetFeatureAdapterArgs {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  // Reference-sequence adapter config for adapters that decode against the
  // reference (BAM/CRAM). Read straight off the RPC args and forwarded — no
  // execute builds one, because `renameRegionsIfNeeded` derives it from the
  // assembly it already resolved. Optional because the RPCs that don't rename
  // regions have no assembly context to derive it from.
  sequenceAdapter?: Record<string, unknown>
}

/**
 * Resolve a feature data adapter and prime its reference-sequence adapter
 * config in one step — the single resolution path for every RPC that reads
 * features. Returns undefined when the config resolves to a non-feature
 * adapter, so callers that can degrade (e.g. getRefNames → []) decide how; use
 * {@link getFeatureAdapterOrThrow} when a feature adapter is required.
 */
export async function getFeatureAdapter({
  pluginManager,
  sessionId,
  adapterConfig,
  sequenceAdapter,
}: GetFeatureAdapterArgs): Promise<BaseFeatureDataAdapter | undefined> {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const featureAdapter = isFeatureAdapter(dataAdapter) ? dataAdapter : undefined
  featureAdapter?.setSequenceAdapterConfig(sequenceAdapter)
  return featureAdapter
}

/**
 * {@link getFeatureAdapter} for the common case where the RPC cannot proceed
 * without a feature adapter: throws a clear error instead of returning
 * undefined, so callers get a definite type and no cast.
 */
export async function getFeatureAdapterOrThrow(
  args: GetFeatureAdapterArgs,
): Promise<BaseFeatureDataAdapter> {
  const dataAdapter = await getFeatureAdapter(args)
  if (!dataAdapter) {
    throw new Error(
      `adapter "${args.adapterConfig.type}" is not a feature adapter`,
    )
  }
  return dataAdapter
}
