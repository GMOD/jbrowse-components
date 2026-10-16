import { isFeatureAdapter } from './BaseAdapter/index.ts'
import { getAdapter } from './dataAdapterCache.ts'

import type PluginManager from '../PluginManager.ts'
import type { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'

export interface GetFeatureAdapterArgs {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
}

/**
 * Resolve a feature data adapter — the single resolution path for every RPC
 * that reads features. An RPC passes its whole args (`{ ...args, pluginManager
 * }`) so the `sequenceAdapter` serialization attached reaches the cache without
 * being named, and a reference-reading type comes back built for that genome.
 * Returns undefined when the config resolves to a non-feature adapter, so
 * callers that can degrade (e.g. getRefNames → []) decide how; use
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
    sequenceAdapter,
  )
  return isFeatureAdapter(dataAdapter) ? dataAdapter : undefined
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

/**
 * The cached adapter a `@jbrowse/tables` read uses, which every tables
 * lookup goes through. A `READS_REFERENCE` adapter is keyed on its
 * config and `sequenceAdapter`, so a lookup without the one the read uses
 * builds a second instance with its own index.
 */
export async function tablesAdapter(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  return (
    await getAdapter(pluginManager, 'tables', adapterConfig, sequenceAdapter)
  ).dataAdapter
}

/** {@link tablesAdapter}, refusing an adapter that serves no features. */
export async function tablesFeatureAdapter(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  const adapter = await tablesAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  if (!isFeatureAdapter(adapter)) {
    throw new Error(`adapter "${adapterConfig.type}" is not a feature adapter`)
  }
  return adapter
}
