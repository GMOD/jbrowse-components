import { lazy } from 'react'

import { lazyMap } from './lazify.tsx'

export const BaseFeatureDetail = lazyMap(
  {
    Attributes: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/Attributes.tsx'),
    ),
    FeatureDetails: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails.tsx'),
    ),
    BaseCard: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCard.tsx'),
    ),
    BaseAttributes: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseAttributes.tsx'),
    ),
    BaseCoreDetails: lazy(
      () =>
        import('../BaseFeatureWidget/BaseFeatureDetail/BaseCoreDetails.tsx'),
    ),
  },
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/',
)
