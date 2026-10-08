import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearSyntenyDisplay
 *
 * #example
 * A `SyntenyTrack` config to paste into `tracks`. The adapter needs the query
 * (first) and target (second) assembly names, matched by the track's
 * `assemblyNames`. See the
 * [synteny track guide](/docs/config_guides/synteny_track) for all options:
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
 * }
 * ```
 */
function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {},
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
      // v4's renderer block held the colour the view paints with now, and
      // `middle` drew the ribbons from the view's midline
      retired: { renderer: () => ({}), middle: () => ({}) },
    },
  )
}

export type LinearSyntenyDisplayConfigSchema = ReturnType<
  typeof configSchemaFactory
>

export default configSchemaFactory
