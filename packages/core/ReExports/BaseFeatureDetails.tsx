import { lazy } from 'react'

import { lazyMap } from './lazify'

export const BaseFeatureDetail = lazyMap(
  {
    Attributes: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/Attributes'),
    ),
    FeatureDetails: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'),
    ),
    BaseCard: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCard'),
    ),
    BaseAttributes: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseAttributes'),
    ),
    BaseCoreDetails: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCoreDetails'),
    ),
  },
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/',
)
