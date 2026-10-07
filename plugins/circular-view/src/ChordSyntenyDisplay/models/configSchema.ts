import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { chordConfigSchemaFields } from '../../chords/chordConfigSchemaFields.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config ChordSyntenyDisplay
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
 * between the span it covers on one side and the span its mate covers on the
 * other. What a ribbon's colour says is the circular view's `color`, as in
 * the linear synteny view, with its `alpha` and `minAlignmentLength`; these
 * slots are the hovered and selected fills:
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
 *       colorHover: 'rgba(0,0,0,0.5)',
 *     },
 *   ],
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
