import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slot `FeatureGateMixin` reads: the density budget past which the
 * region-too-large banner refuses. Spread by every display composing the
 * mixin, at whatever depth its `configuredMaxFeatureScreenDensity` reads.
 */
export const featureGateConfigSchemaFields = {
  /**
   * #slot
   */
  maxFeatureScreenDensity: {
    type: 'number',
    description:
      'maximum features per pixel before showing a "too many features" message',
    defaultValue: 1,
    advanced: true,
  },
} as const

export type FeatureGateConfigModel = ConfigModelForFields<
  typeof featureGateConfigSchemaFields
>
