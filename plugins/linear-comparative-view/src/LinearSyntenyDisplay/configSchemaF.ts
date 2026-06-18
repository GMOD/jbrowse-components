import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearSyntenyDisplay
 *
 * #example
 * A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs
 * the query (first) and target (second) assembly names, matched by the track's
 * `assemblyNames`:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {
      /**
       * #slot
       * currently unused
       */
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },

      /**
       * #slot
       * currently unused
       */
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export default configSchemaFactory
