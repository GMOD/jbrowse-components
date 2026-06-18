import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config DotplotDisplay
 *
 * #example
 * The dot-plot rendering of a `SyntenyTrack`, for use inside a `DotplotView`
 * (rather than the two-row `LinearSyntenyDisplay` or the plain-LGV
 * `LGVSyntenyDisplay`) — same track config, different display type:
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
 *       type: 'DotplotDisplay',
 *       displayId: 'hg38_vs_mm10-DotplotDisplay',
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'DotplotDisplay',
    {},
    {
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}
