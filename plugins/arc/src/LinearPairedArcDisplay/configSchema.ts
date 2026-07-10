import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type { Instance } from '@jbrowse/mobx-state-tree'

// default arc stroke width in px, shared by the config-slot default and the
// track-menu slider's reset/is-default check so they can't drift
export const defaultArcLineWidth = 3

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
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearPairedArcDisplay',
    {
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
        type: 'number',
        description: 'the stroke width of the arcs, in pixels',
        defaultValue: defaultArcLineWidth,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearPairedArcDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearPairedArcDisplayConfig =
  Instance<LinearPairedArcDisplayConfigModel>
