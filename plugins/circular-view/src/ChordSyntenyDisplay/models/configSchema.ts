import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'

// The synteny strand colors (`colorSchemes.strand` in synteny-core: red
// forward, blue reverse), as the jexl a config author edits, and translucent
// because a whole-genome alignment stacks hundreds of ribbons over one contig.
// A literal rather than the imported constant so this schema — which every
// session builds eagerly — pulls none of synteny-core in with it.
const colorByStrand =
  "jexl:get(feature,'strand')==-1?'rgba(0,0,255,0.25)':'rgba(255,0,0,0.25)'"

/**
 * #config ChordSyntenyDisplay
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
 * between the span it covers on one side and the span its mate covers on the
 * other. The three color slots are its resting, hovered and selected fills,
 * and each takes a `jexl:` expression over the `feature` — the default colors
 * by strand, and anything on the record can drive it instead:
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
 * How deep a ribbon bows toward the center is `bezierRadiusRatio`, a display
 * state-model property rather than a config slot — a saved session carries it,
 * a track config drops it.
 */
function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordSyntenyDisplay',
    {
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the fill color of each ribbon',
        defaultValue: colorByStrand,
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
