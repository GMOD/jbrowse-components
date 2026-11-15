import { canonicalizeViewRefName, getContainingView } from './mstUtils.ts'
import { getRpcSessionId } from './parentWalk.ts'
import { getRpcHost } from './sessionServices.ts'

import type { Feature } from './simpleFeature.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface AdapterRecordHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
}

/**
 * #api
 * The record behind a drawn or overlaid feature as its display's adapter holds
 * it, every field included, where the display paints from a slim copy. Read
 * over the feature's first base rather than its span, a zero-length one
 * straddled; `undefined` when the adapter holds no record with its id there.
 */
export async function fetchAdapterRecord(
  self: AdapterRecordHost,
  feature: Feature,
  opts: { signal?: AbortSignal } = {},
) {
  const assemblyName = getContainingView(self).assemblyNames?.[0]
  const start = feature.get('start')
  const end = feature.get('end')
  const records = assemblyName
    ? await getRpcHost(self).rpcManager.call(
        getRpcSessionId(self),
        'CoreGetFeatures',
        {
          adapterConfig: self.adapterConfig,
          regions: [
            {
              assemblyName,
              refName: canonicalizeViewRefName(self, feature.get('refName')),
              start: end > start ? start : Math.max(0, start - 1),
              end: start + 1,
            },
          ],
          ...opts,
        },
      )
    : []
  return records.find(record => record.id() === feature.id())
}
