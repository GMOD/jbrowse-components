import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { utrDefaultColor } from '@jbrowse/core/ui/palette'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { lodModeSlot } from '@jbrowse/synteny-core'

import { geneColorConfigSchema } from './geneColorConfigSchema.ts'
import { laneLayerConfigSchema } from './laneLayerConfigSchema.ts'
import { laneRowsConfigSchema } from './laneRowsConfigSchema.ts'
import { ribbonColorConfigSchema } from './ribbonColorConfigSchema.ts'

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
 *       rows: { domain: ['panTro6', 'gorGor6', 'ponAbe3'] },
 *       color: { field: 'cluster' },
 *       ribbonColor: { field: 'identity' },
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
       * #slot color
       * The gene glyphs' fill: a CSS color or `jexl:` callback, goldenrod
       * unset, or `{ field }` to paint each value its own palette color with
       * a key.
       */
      color: geneColorConfigSchema,
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
      ...lodModeSlot,
      /**
       * #slot rows
       * The lane order and the lanes drawn, which the Lanes menu, a header
       * drag and the lane picker write.
       */
      rows: laneRowsConfigSchema,
      /**
       * #slot ribbonColor
       * `"rgba(130,130,130,0.3)"` paints every ribbon; `{ field: "strand" }`
       * the record's strand, `{ field: "identity" }` a preset ramp and
       * `{ field: "group" }` a declared column.
       */
      ribbonColor: ribbonColorConfigSchema,
      /**
       * #slot
       */
      hideUnlabelled: {
        type: 'boolean',
        description:
          'under a text column, draw only the ribbons whose pair carries a label',
        defaultValue: false,
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
      laneGeneTracks: {
        type: 'stringArray',
        description:
          "the trackId of the gene track each lane draws, one per genome. A lane whose genome no entry names draws the session's best-ranked annotation track for it, which on a config holding several gene sets per genome is whichever is declared first",
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
       * #slot
       */
      showLegend: {
        type: 'boolean',
        description:
          "show the color key: the anchor lane's drawn gene colors, and what `ribbonColor` paints — the strand colors, the identity ramp, or a column's labels. Derived from what is on screen, so a `color` slot resolving to one color and a ribbon scale painting nothing key nothing. Defaults to on",
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
       * The feature field, or jexl expression over `feature`, each lane's
       * gene labels print; unset, the gene's name, else its ID.
       */
      text: {
        type: 'featureField',
        defaultValue: '',
        description: 'gene label field, or jexl expression',
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
      laneLayers: types.array(laneLayerConfigSchema),
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
    },
  )
}

export type MultiWaySyntenyDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>

export type MultiWaySyntenyDisplayConfig =
  Instance<MultiWaySyntenyDisplayConfigModel>
