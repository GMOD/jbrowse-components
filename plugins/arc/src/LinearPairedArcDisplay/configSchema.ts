import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import { arcLegendConfigSchemaFields } from '../shared/arcColorConfigSchema.ts'
import { pairedArcColorSchema } from '../shared/pairedArcColorConfigSchema.ts'
import { scoreFilterConfigSchemaFields } from '../shared/scoreFilter.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

const defaultArcLineWidth = 3

/**
 * #config LinearPairedArcDisplay
 *
 * #example
 * Selected on a `VariantTrack` of structural variants: each feature draws an arc
 * from its position to its mate breakend (parsed from the VCF `ALT`), connecting
 * the two loci even when the mate is on another chromosome / displayed region.
 * Short ticks mark each breakend's mate direction; clicking an arc opens the
 * variant details. `color` defaults to a colour per SV type read off the ALT,
 * and takes a field with a scale and a key, `{ field: 'INFO.SVTYPE' }`
 * ([PairedArcColor](../pairedarccolor)):
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
       * #slot color
       * The arcs' colour: a CSS colour, a jexl callback over `feature` and
       * `alt`, or a field bound to a categorical or threshold scale, which
       * the key describes.
       */
      color: pairedArcColorSchema,
      ...arcLegendConfigSchemaFields,
      /**
       * #slot
       */
      lineWidth: {
        type: 'number',
        description: 'the stroke width of the arcs, in pixels',
        defaultValue: defaultArcLineWidth,
      },
      ...scoreFilterConfigSchemaFields,
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
