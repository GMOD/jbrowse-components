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
export async function loadSubAdapter<
  T extends BaseFeatureDataAdapter = BaseFeatureDataAdapter,
>(
  self: BaseFeatureDataAdapter,
  subType: string,
  opts?: BaseOptions,
): Promise<{ adapter: T }> {
  if (!self.getSubAdapter) {
    throw new Error('no getSubAdapter available')
  }
  const { statusCallback = () => {} } = opts ?? {}
  return updateStatus('Downloading index', statusCallback, async () => {
    const result = await self.getSubAdapter!({
      ...getSnapshot(self.config),
      type: subType,
    })
    return { adapter: result.dataAdapter as T }
  })
}

/**
 * Memoize an async setup step on `holder.setupP`. On failure the slot is
 * cleared so the next call retries instead of permanently caching the
 * rejection. This is the primary-adapter setup used by all three MAF adapters;
 * `holder.setupReady` flips true once the setup resolves, so callers can skip
 * re-showing a "Downloading index" status on pan/zoom re-entry.
 *
 * `BigMafAdapter.getSummaryAdapter` repeats the same catch-clear-rethrow
 * memoize inline on a *second* slot rather than reusing this — generalizing the
 * helper over the slot name would leak more than the few duplicated lines save.
 */
export function lazyInit<T>(
  holder: { setupP?: Promise<T>; setupReady?: boolean },
  factory: () => Promise<T>,
): Promise<T> {
  holder.setupP ??= factory()
    .then(result => {
      holder.setupReady = true
      return result
    })
    .catch((e: unknown) => {
      holder.setupP = undefined
      throw e
    })
  return holder.setupP
}
