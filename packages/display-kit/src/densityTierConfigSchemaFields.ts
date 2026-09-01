import { types } from '@jbrowse/mobx-state-tree'

import { DENSITY_TIER_MODES } from './densityTier.ts'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The slots `DensityTierMixin` reads, spread into the base linear display
 * schema the way `regionTooLargeConfigSchemaFields` is.
 */
export const densityTierConfigSchemaFields = {
  /**
   * #slot
   */
  densityTier: {
    type: 'stringEnum',
    model: types.enumeration('Density tier', [...DENSITY_TIER_MODES]),
    defaultValue: 'auto',
    description:
      'when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)',
    advanced: true,
  },
  /**
   * #slot
   */
  densityTierBpPerPx: {
    type: 'number',
    defaultValue: 0,
    description:
      'in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone',
    advanced: true,
  },
} as const

export type DensityTierConfigModel = ConfigModelForFields<
  typeof densityTierConfigSchemaFields
>
