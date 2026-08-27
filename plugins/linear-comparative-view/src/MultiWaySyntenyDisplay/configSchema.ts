import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'

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
      /**
       * #slot
       */
      drawCurves: {
        type: 'boolean',
        description:
          "draw the ribbons as bezier curves rather than straight chords, the same setting the linear synteny view spells `drawCurves`. Straight is the default there and here: a chord's slant reads directly as the offset between two lanes drawn in different coordinate frames, which is exactly what a curve hides",
        defaultValue: false,
      },
      /**
       * #slot
       */
      bridgeSkippedLanes: {
        type: 'boolean',
        description:
          'join a group across a lane that places nothing for it, to the next lane down that does, at half the ribbon opacity. A ribbon otherwise joins adjacent lanes only, so a sparse lane mid-stack cuts every chain running through it',
        defaultValue: true,
      },
      /**
       * #slot
       */
      showLaneTicks: {
        type: 'boolean',
        description:
          "draw each lane's own coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out. Turning this off leaves the header's span and multiple as the only scale statement",
        defaultValue: true,
      },
      /**
       * #slot
       * overrides the base schema's 100, which divides into a lane stack at
       * the glyph-height floor with the headers colliding into the glyphs
       */
      height: {
        type: 'number',
        description: 'default height for the track',
        defaultValue: 240,
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
