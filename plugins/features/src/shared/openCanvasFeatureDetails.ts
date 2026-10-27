import { openFeatureWidget, withFeatureDetails } from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'

import type {
  Feature,
  FeatureWidgetTypeRef,
  ParentFeatureSummary,
} from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FeatureDetailsHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  featureWidgetType: FeatureWidgetTypeRef
}

/**
 * A factory called once per display inside an `.actions` closure, because the
 * header-metadata memo it holds has to outlive the click.
 */
export function createCanvasFeatureDetailsOpener(self: FeatureDetailsHost) {
  const fetchMetadata = createAdapterMetadataFetch(self)
  return (
    fetch: () => Promise<Feature | undefined>,
    parentFeature?: ParentFeatureSummary,
  ) => {
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
          parentFeature,
        })
      },
    )
  }
}
