import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import type { Instance } from '@jbrowse/mobx-state-tree'

// default arc stroke width in px; the promotable slot's `promotedBase` (the
// track-menu slider reads/resets via isSlotCustomized, not this constant)
const defaultArcLineWidth = 3

/**
 * #config LinearPairedArcDisplay
 *
 * #example
 * Selected on a `VariantTrack` of structural variants: each feature draws an arc
 * from its position to its mate breakend (parsed from the VCF `ALT`), connecting
 * the two loci even when the mate is on another chromosome / displayed region.
 * Short ticks mark each breakend's mate direction; clicking an arc opens the
 * variant details. `color` is jexl-evaluated per `(feature, alt)`:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'sv',
 *   name: 'Structural variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/sv.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearPairedArcDisplay',
 *       displayId: 'sv-LinearPairedArcDisplay',
 *     },
 *   ],
 * }
 * ```
 */
// #region schema
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearPairedArcDisplay',
    {
      ...trackHeightConfigSchemaFields(),
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the color of the arcs',
        defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
        contextVariable: ['feature', 'alt'],
      },
      /**
       * #slot
       */
      lineWidth: {
        type: 'maybeNumber',
        description:
          'the stroke width of the arcs, in pixels. Unset (the default) follows the session-wide default for this display type',
        // sentinel promotable slot: see promotableDefaults.ts
        promotedBase: defaultArcLineWidth,
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: 0,
        description:
          'hide arcs whose feature score is below this; features with no score are always drawn',
      },
      ...regionTooLargeConfigSchemaFields,
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
    },
  )
}
// #endregion

export type LinearPairedArcDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearPairedArcDisplayConfig =
  Instance<LinearPairedArcDisplayConfigModel>
