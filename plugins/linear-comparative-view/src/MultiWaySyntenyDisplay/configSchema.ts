import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'

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
      domain: {
        type: 'stringArray',
        description:
          'the lanes that stack first below the anchor, in order; the rest follow densest-first, so a ribbon chain through adjacent lanes is cut as late as possible. What the Lanes menu and a header drag write',
        defaultValue: [],
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
      ribbonColorBy: {
        type: 'string',
        description:
          "what colors a ribbon, in the synteny view's `colorBy` spelling: `default` is ribbonColor; `strand` reads the record's strand — the two placements' orientations against the anchor multiplied out — and not the drawn twist, so a lane drawn flipped still shows its inversions; `identity`, `mappingQuality` and `dnds` paint the synteny view's ramps; `attribute:<column>` reads a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a `color` column put beside it). A pair carrying no value keeps ribbonColor, and every mode keeps its opacity. The synteny view's `track`, `query`, `target` and `reference` modes paint ribbonColor here",
        defaultValue: 'default',
      },
      /**
       * #slot
       */
      hideUnlabelled: {
        type: 'boolean',
        description:
          'under an `attribute:<column>` text mode, draw only the ribbons whose pair carries a label',
        defaultValue: false,
      },
      /**
       * #slot
       */
      ribbonColorDomain: {
        type: 'stringArray',
        description:
          "the order an `attribute:<column>` mode's labels take: the labels listed here first, the rest sorted. The order is the palette's too — a label's color is its position — so this moves the key and the ribbons together. Left empty the labels stay in the order the fetches first met them. The other modes paint a fixed pair or a ramp and ignore it",
        defaultValue: [],
      },
      /**
       * #slot
       */
      drawCurves: {
        type: 'boolean',
        description:
          "draw the ribbons as bezier curves rather than straight chords. A plain per-track slot: this display does not share the linear synteny view's view-level `drawCurves` override. Straight is the default in both places: a chord's slant reads directly as the offset between two lanes drawn in different coordinate frames, which is exactly what a curve hides",
        defaultValue: false,
      },
      /**
       * #slot
       */
      bridgeSkippedLanes: {
        type: 'boolean',
        description:
          'join a group across a lane that places nothing for it, to the next lane down that does. A ribbon otherwise joins adjacent lanes only, so a sparse lane mid-stack cuts every chain running through it',
        defaultValue: true,
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'boolean',
        description:
          "show the color key: the anchor lane's drawn gene colors, and what `ribbonColorBy` paints — the strand colors, the identity ramp, or a column's labels. Derived from what is on screen, so a `color` slot resolving to one color and a ribbon mode painting nothing key nothing. Defaults to on",
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
