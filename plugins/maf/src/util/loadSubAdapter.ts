import { updateStatus } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * BigMafAdapter and MafTabixAdapter both wrap a sub-adapter (BigBed /
 * BedTabix) and need identical "download index → snapshot config → swap type
 * → typecast" plumbing. This is the single source of truth.
 */
export async function loadSubAdapter(
  self: BaseFeatureDataAdapter,
  subType: string,
  opts?: BaseOptions,
): Promise<{ adapter: BaseFeatureDataAdapter }> {
  if (!self.getSubAdapter) {
    throw new Error('no getSubAdapter available')
  }
  const { statusCallback = () => {} } = opts ?? {}
  return updateStatus('Downloading index', statusCallback, async () => {
    const result = await self.getSubAdapter!({
      ...getSnapshot(self.config),
      type: subType,
    })
    return { adapter: result.dataAdapter as BaseFeatureDataAdapter }
  })
}

/**
 * Memoize an async setup step on `holder.setupP`. On failure the slot is
 * cleared so the next call retries instead of permanently caching the
 * rejection. All three MAF adapters need this exact pattern; capturing it
 * here keeps the catch-clear-rethrow invariant in one place.
 */
export function lazyInit<T>(
  holder: { setupP?: Promise<T> },
  factory: () => Promise<T>,
): Promise<T> {
  holder.setupP ??= factory().catch((e: unknown) => {
    holder.setupP = undefined
    throw e
  })
  return holder.setupP
}
