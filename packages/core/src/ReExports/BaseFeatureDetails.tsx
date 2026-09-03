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
    FeatureWash: lazy(
      () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureWash.tsx'),
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
  // No prefix. lazyMap's prefix builds *module map* keys -- it is how one call
  // yields '@mui/material/Button', '@mui/material/Dialog' and the rest as
  // separate served modules. This call is the contents of a single served
  // module, so a prefix here made its keys the full subpaths
  // ('@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'), and the
  // documented `import { BaseCard } from
  // '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'` -- which every in-tree
  // consumer writes, and which resolves to the real module for them -- read
  // undefined out of JBrowseExports for an external plugin. Published ideogram
  // 2.0.0 does exactly that for BaseCard and FeatureDetails.
)
