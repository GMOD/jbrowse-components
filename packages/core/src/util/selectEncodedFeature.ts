import { openFeatureWidget } from './openFeatureWidget.ts'
import { getRpcSessionId } from './parentWalk.ts'
import { getRpcHost } from './sessionServices.ts'
import SimpleFeature from './simpleFeature.ts'
import { withFeatureDetails } from './withFeatureDetails.ts'

import type { createAbortRotation } from './createAbortRotation.ts'
import type { CoreGetEncodedLayersArgs } from './markEncodingTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #api
 * Open the feature widget on the feature behind one instance of a
 * `CoreGetEncodedLayers` answer. A display holds channels, not records, so it
 * sends `CoreGetEncodedFeature` the request the instance's region came back
 * under, and the worker answers the entry of `layer`'s list that the
 * instance's `featureIndex` names: the record as the adapter wrote it, or the
 * bin or run the steps made. A second click aborts the first.
 */
export function selectEncodedFeature(
  self: IStateTreeNode,
  rotation: ReturnType<typeof createAbortRotation>,
  args: Omit<CoreGetEncodedLayersArgs, 'byteLimit'> & {
    layer: number
    featureIndex: number
  },
) {
  const fetch = rotation.begin()
  void withFeatureDetails(
    self,
    async () => {
      try {
        const feature = await getRpcHost(self).rpcManager.call(
          getRpcSessionId(self),
          'CoreGetEncodedFeature',
          {
            ...args,
            signal: fetch.signal,
            statusCallback: fetch.statusCallback,
          },
        )
        return feature && fetch.isCurrent()
          ? new SimpleFeature(feature)
          : undefined
      } finally {
        fetch.end()
      }
    },
    feature => {
      openFeatureWidget(self, feature.toJSON(), { feature })
    },
  )
}
