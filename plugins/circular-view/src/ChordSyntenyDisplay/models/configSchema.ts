import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { chordConfigSchemaFields } from '../../chords/chordConfigSchemaFields.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// One flat translucent fill for every ribbon. Translucent because a whole-genome
// alignment stacks hundreds of ribbons over one contig, and flat because the
// strand is already in the geometry: a reverse alignment twists between its two
// ends (`ribbonAngles`), so painting it a second color spends the whole figure's
// color budget on something the shape says. Human against mouse is the case
// that settled it — every autosome carries inversions, so a per-strand palette
// filled the circle with interleaved red and blue and no reader could follow one
// bundle through it.
//
// A literal rather than a constant imported from synteny-core, so this schema —
// which every session builds eagerly — pulls none of that package in with it.
const flatRibbonColor = 'rgba(70,130,180,0.25)'

/** What a ribbon's hue can say, and what the track menu calls each. */
export const CHORD_COLOR_BY = [
  { value: 'default', label: 'Track color' },
  { value: 'chromosome', label: "First genome's chromosome" },
  { value: 'strand', label: 'Strand' },
] as const

export type RibbonColorBy = (typeof CHORD_COLOR_BY)[number]['value']

/**
 * #config ChordSyntenyDisplay
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
 * between the span it covers on one side and the span its mate covers on the
 * other. The three color slots are its resting, hovered and selected fills, and
 * each takes a `jexl:` expression over the `feature`, so anything on the record
 * can drive the fill — here the alignment's score:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'volvox_self',
 *   name: 'Volvox self-alignment',
 *   assemblyNames: ['volvox', 'volvox'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/volvox_self.paf',
 *     queryAssembly: 'volvox',
 *     targetAssembly: 'volvox',
 *   },
 *   displays: [
 *     {
 *       type: 'ChordSyntenyDisplay',
 *       displayId: 'volvox_self-ChordSyntenyDisplay',
 *       color: "jexl:get(feature,'score')>1000?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.1)'",
 *     },
 *   ],
 * }
 * ```
 * The default is one flat translucent fill, since a reverse alignment already
 * twists between its two ends. To color by strand as the linear synteny
 * displays do:
 * ```js
 * {
 *   color: "jexl:get(feature,'strand')==-1?'rgba(0,0,255,0.25)':'rgba(255,0,0,0.25)'",
 * }
 * ```
 */
function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordSyntenyDisplay',
    {
      ...chordConfigSchemaFields,
      /**
       * #slot
       */
      colorBy: {
        type: 'stringEnum',
        model: types.enumeration<RibbonColorBy>(
          'ChordSyntenyColorBy',
          CHORD_COLOR_BY.map(c => c.value),
        ),
        defaultValue: 'default',
        description:
          "what a ribbon's hue says: 'default' is the color slot, 'chromosome' the arc color of the chromosome it joins on the circle's first genome, and 'strand' the alignment's strand, which is also the twist in every mode",
      },
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the fill color of each ribbon',
        defaultValue: flatRibbonColor,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      colorSelected: {
        type: 'color',
        description: 'the fill color of a ribbon that has been selected',
        defaultValue: 'rgba(0,0,0,0.6)',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      colorHover: {
        type: 'color',
        description:
          'the fill color of a ribbon that is being hovered over with the mouse',
        defaultValue: 'rgba(85,85,85,0.6)',
        contextVariable: ['feature'],
      },
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF

export type ChordSyntenyDisplayConfigModel = ReturnType<typeof configSchemaF>
