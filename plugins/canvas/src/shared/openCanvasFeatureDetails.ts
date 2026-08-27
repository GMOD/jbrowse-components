import { openFeatureWidget, withFeatureDetails } from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'

import type { Feature, FeatureWidgetTypeRef } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FeatureDetailsHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  featureWidgetType: FeatureWidgetTypeRef
}

/**
 * How both canvas displays open the feature-details widget. A factory called
 * once per display inside an `.actions` closure, because the header-metadata
 * memo it holds (`createAdapterMetadataFetch`) has to outlive the click.
 *
 * The metadata rides in as `descriptions` so the widget can label attribute
 * rows and, for the variant widget, resolve the ANN/CSQ column names;
 * `CoreGetMetadata` answers null for adapters that expose none.
 *
 * `fetch` resolving to nothing is the miss `withFeatureDetails` reports, and a
 * throw from either round trip is the error it reports — one place for both.
 */
export function createCanvasFeatureDetailsOpener(self: FeatureDetailsHost) {
  const fetchMetadata = createAdapterMetadataFetch(self)
  return (fetch: () => Promise<Feature | undefined>) => {
    let descriptions: unknown
    return withFeatureDetails(
      self,
      async () => {
        const feature = await fetch()
        if (feature) {
          descriptions = await fetchMetadata()
        }
        return feature
      },
      feature => {
        openFeatureWidget(self, feature.toJSON(), {
          widget: self.featureWidgetType,
          extra: { descriptions },
          feature,
        })
      },
    )
  }
}
