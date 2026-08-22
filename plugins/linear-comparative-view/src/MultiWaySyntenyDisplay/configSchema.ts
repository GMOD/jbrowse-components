import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MultiWaySyntenyDisplay
 *
 * #example
 * Selected on a multi-genome `SyntenyTrack` (an `MCScanBlocksAdapter` listing
 * several assemblies) shown in a plain linear genome view. Draws one lane per
 * assembly in that assembly's own local coordinate frame — non-anchored, like
 * the multi-sample variant matrix — with ribbons connecting each gene's
 * placements between adjacent lanes:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'grape_peach_cacao',
 *   name: 'grape/peach/cacao orthologs',
 *   assemblyNames: ['grape', 'peach', 'cacao'],
 *   adapter: {
 *     type: 'MCScanBlocksAdapter',
 *     uri: 'grape.blocks',
 *     blockAssemblies: ['grape', 'peach', 'cacao'],
 *     bedLocations: [
 *       { uri: 'grape.bed' },
 *       { uri: 'peach.bed' },
 *       { uri: 'cacao.bed' },
 *     ],
 *     assemblyNames: ['grape', 'peach', 'cacao'],
 *   },
 *   displays: [
 *     {
 *       type: 'MultiWaySyntenyDisplay',
 *       displayId: 'grape_peach_cacao-MultiWaySyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'MultiWaySyntenyDisplay',
    {
      /**
       * #slot
       */
      // #region contextVariableSlot
      color: {
        type: 'color',
        description:
          'the fill color of the gene glyphs, matching the canvas gene track default',
        defaultValue: featureDefaultColor,
        contextVariable: ['feature'],
      },
      // #endregion
      /**
       * #slot
       */
      utrColor: {
        type: 'color',
        description:
          'the fill color of the untranslated parts of a gene glyph, matching the canvas gene track default',
        defaultValue: utrDefaultColor,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      ribbonColor: {
        type: 'color',
        description: 'the color of the ribbons connecting adjacent lanes',
        defaultValue: 'rgba(130,130,130,0.3)',
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

export type MultiWaySyntenyDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type MultiWaySyntenyDisplayConfig =
  Instance<MultiWaySyntenyDisplayConfigModel>
