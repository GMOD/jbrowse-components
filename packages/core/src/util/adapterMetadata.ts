import { adapterConfigKey } from './adapterConfigKey.ts'
import { getRpcSessionId } from './parentWalk.ts'
import { getRpcHost } from './sessionServices.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A display's adapter header metadata (VCF INFO/FORMAT descriptions, and
 * whatever else `CoreGetMetadata` answers for the adapter), fetched once per
 * adapter config and reused across every feature-details open.
 *
 * Every open otherwise round-trips the worker to re-read a header the fetch
 * that put the feature on screen already parsed. Canvas and the multi-sample
 * variant base each carried this memo by hand; the copies had already drifted
 * on nothing but were one more thing a third display would write a third way.
 *
 * Keyed on the adapter config rather than memoized for the display's life, so
 * a track re-pointed in the config editor stops serving the old header's
 * descriptions. Cleared on failure so a later click retries. No stop token and
 * no status: nothing to narrate, and nothing a cancel could save — the widget
 * opens on the result.
 */
export function createAdapterMetadataFetch(
  self: IStateTreeNode & { adapterConfig: Record<string, unknown> },
) {
  let cached: { key: string; promise: Promise<unknown> } | undefined
  return () => {
    const key = adapterConfigKey(self.adapterConfig)
    if (cached?.key !== key) {
      const promise = getRpcHost(self)
        // eslint-disable-next-line no-restricted-syntax -- nothing to narrate, nothing a cancel could save
        .rpcManager.call(getRpcSessionId(self), 'CoreGetMetadata', {
          adapterConfig: self.adapterConfig,
        })
        .catch((e: unknown) => {
          if (cached?.promise === promise) {
            cached = undefined
          }
          throw e
        })
      cached = { key, promise }
    }
    return cached.promise
  }
}
