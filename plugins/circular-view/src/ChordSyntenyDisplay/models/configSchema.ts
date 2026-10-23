import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { chordMarkConfigSchema } from '../../chords/chordMarkConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config ChordSyntenyDisplay
 * Draws a `SyntenyTrack` in a `CircularView`, with a ribbon joining the two
 * spans of each alignment.
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
 * between the span it covers on one side and the span its mate covers on the
 * other. The circular view's `encoding.color`, `encoding.opacity` and `filter` decide which
 * ribbons draw and in what color, as in the linear synteny view; these slots
 * are the hovered and selected fills:
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
 *     },
 *   ],
 * }
 * ```
 */
function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordSyntenyDisplay',
    {
      /**
       * #slot
       * How far each chord curves toward the center, a
       * [](/docs/config/chordmark) object
       */
      mark: chordMarkConfigSchema,
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF

export type ChordSyntenyDisplayConfigModel = ReturnType<typeof configSchemaF>
