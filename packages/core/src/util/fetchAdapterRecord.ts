import { canonicalizeViewRefName, getContainingView } from './mstUtils.ts'
import { getRpcSessionId } from './parentWalk.ts'
import { getRpcHost } from './sessionServices.ts'
import SimpleFeature from './simpleFeature.ts'

import type { RegionLike, RpcHandles } from '../rpc/RpcRegistry.ts'
import type { Feature } from './simpleFeature.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface AdapterRecordHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
}

/**
 * #api
 * The record with `featureId` as its display's adapter holds it over
 * `region`, every field included, picked in the worker; `undefined` when the
 * adapter holds no record with that id there. Only the locus crosses to the
 * worker, not whatever else a loaded region carries.
 */
export async function fetchAdapterRecordById(
  self: AdapterRecordHost,
  featureId: string,
  { assemblyName, refName, start, end }: RegionLike,
  opts: RpcHandles = {},
) {
  const { feature } = await getRpcHost(self).rpcManager.call(
    getRpcSessionId(self),
    'GetBasicFeatureDetails',
    {
      adapterConfig: self.adapterConfig,
      featureId,
      region: { assemblyName, refName, start, end },
      ...opts,
    },
  )
  return feature ? new SimpleFeature(feature) : undefined
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
  opts: RpcHandles = {},
) {
  const assemblyName = getContainingView(self).assemblyNames?.[0]
  const start = feature.get('start')
  const end = feature.get('end')
  return assemblyName
    ? fetchAdapterRecordById(
        self,
        feature.id(),
        {
          assemblyName,
          refName: canonicalizeViewRefName(self, feature.get('refName')),
          start: end > start ? start : Math.max(0, start - 1),
          end: start + 1,
        },
        opts,
      )
    : undefined
}
