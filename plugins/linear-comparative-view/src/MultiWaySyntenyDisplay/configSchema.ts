import { ConfigurationSchema, plotList } from '@jbrowse/core/configuration'
import { utrDefaultColor } from '@jbrowse/core/ui/palette'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { syntenyDataConfigSchema } from '@jbrowse/synteny-core'

import { geneEncodingConfigSchema } from './geneEncodingConfigSchema.ts'
import { laneLayerConfigSchema } from './laneLayerConfigSchema.ts'
import { laneRowsConfigSchema } from './laneRowsConfigSchema.ts'
import { ribbonsConfigSchema } from './ribbonsConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MultiWaySyntenyDisplay
 * Draws a multi-genome `SyntenyTrack` in a linear genome view as one lane per
 * assembly, with ribbons joining each gene's placements in adjacent lanes.
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
 *
 * The same display with a curated lane order, genes colored by ortholog
 * cluster, and ribbons colored by percent identity:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'primate_synteny',
 *   name: 'Primate synteny',
 *   assemblyNames: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
 *   adapter: {
 *     type: 'MCScanBlocksAdapter',
 *     uri: 'hg38.blocks',
 *     blockAssemblies: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
 *     bedLocations: [
 *       { uri: 'hg38.bed' },
 *       { uri: 'panTro6.bed' },
 *       { uri: 'gorGor6.bed' },
 *       { uri: 'ponAbe3.bed' },
 *     ],
 *   },
 *   displays: [
 *     {
 *       type: 'MultiWaySyntenyDisplay',
 *       displayId: 'primate_synteny-MultiWaySyntenyDisplay',
 *       rows: { sort: ['panTro6', 'gorGor6', 'ponAbe3'] },
 *       encoding: { color: 'cluster' },
 *       ribbons: { encoding: { color: 'identity' } },
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
       * #slot encoding
       * The channels the gene glyphs paint through: `encoding.color`, their
       * fill.
       */
      encoding: geneEncodingConfigSchema,
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
       * #slot data
       * What the fetch reads, a [](/docs/config/syntenydata) object:
       * `resolution` picks a tiered file's stored tier.
       */
      data: syntenyDataConfigSchema,
      /**
       * #slot rows
       * The lane order and the lanes drawn, which the Lanes menu, a header
       * drag and the lane picker write.
       */
      rows: laneRowsConfigSchema,
      /**
       * #slot ribbons
       * The bands joining each gene's placements in adjacent lanes:
       * `ribbons.encoding.color` paints them and `ribbons.mark.interpolate`
       * curves their sides.
       */
      ribbons: ribbonsConfigSchema,
      /**
       * #slot
       */
      hideUnlabelled: {
        type: 'boolean',
        description:
          'under a text column, draw only the ribbons whose pair has a label',
        defaultValue: false,
      },
      /**
       * #slot
       */
      laneGeneTracks: {
        type: 'stringArray',
        description:
          "the trackId of the gene track each lane draws, one per genome, or an entry spelling `{assembly}`, such as `{assembly}-ncbiRefSeq`, naming in each lane the track whose id has that lane's genome, or any of its aliases, written there. Plain ids outrank `{assembly}` entries, and an earlier entry outranks a later one. A lane whose genome no entry names draws the session's best-ranked annotation track for it, which on a config holding several gene sets per genome is whichever is declared first",
        defaultValue: [],
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
       * #slot legend
       * The color key: the anchor lane's drawn gene colors, and what
       * `ribbons.encoding.color` paints — the strand colors, the identity
       * ramp, or a column's labels. Derived from what is on screen, so an
       * `encoding.color` resolving to one color and a ribbon scale painting
       * nothing key nothing.
       */
      legend: legendConfigSchema,
      /**
       * #slot
       */
      showLaneTicks: {
        type: 'boolean',
        description:
          "draw each lane's coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out. With this off, the header's span and multiple are the only scale shown",
        defaultValue: true,
      },
      /**
       * #slot
       * The feature field, or jexl expression over `feature`, each lane's
       * gene labels print; unset, the gene's name, else its ID.
       */
      text: {
        type: 'featureField',
        defaultValue: '',
        description: 'gene label field, or jexl expression',
        plot: true,
      },
      /**
       * #slot
       */
      inlineLaneNames: {
        type: 'boolean',
        description:
          "print each lane's genome name over the left end of its gene row, without its coordinates, instead of on a line above the genes. The stack then fits 12 px less per lane",
        defaultValue: false,
      },
      /**
       * #slot
       */
      showGeneLabels: {
        type: 'boolean',
        description:
          "print gene names in a row under each lane's genes, dropping a name where its neighbours leave it no room",
        defaultValue: true,
      },
      /**
       * #slot laneLayers
       * Rows of data every lane draws above its genes, each from that genome's
       * own track: a GC or conservation bigWig per genome as bars, say
       */
      laneLayers: plotList(types.array(laneLayerConfigSchema)),
      /**
       * #slot
       */
      splitStrands: {
        type: 'boolean',
        description:
          "draw each lane's genes in two rows either side of its line: the ones reading rightwards on screen above, leftwards below, so a flipped lane's genes turn over with it and a collinear block keeps one row down the stack. A lane too short for two rows draws one",
        defaultValue: true,
      },
      /**
       * #slot
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
      retired: {
        drawCurves: (curves: unknown) => ({
          ribbons: { mark: { interpolate: curves ? 'bump' : 'linear' } },
        }),
      },
    },
  )
}

export type MultiWaySyntenyDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>

export type MultiWaySyntenyDisplayConfig =
  Instance<MultiWaySyntenyDisplayConfigModel>
