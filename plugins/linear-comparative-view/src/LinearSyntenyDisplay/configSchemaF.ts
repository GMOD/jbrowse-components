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
    {
      /**
       * #slot
       */
      drawCurves: {
        type: 'boolean',
        description:
          "Draw each ribbon as a bezier curve rather than a straight chord. Defaults to off (straight chords). The row is on the VIEW's settings menu (`Curved lines`) — this display curates no track menu of its own — and the checkbox writes this slot on every level of the view, as an init spec's `drawCurves` key does for the tracks it opens",
        defaultValue: false,
      },
      /**
       * #slot
       */
      drawLocationMarkers: {
        type: 'boolean',
        description:
          "Continue the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. Defaults to off, through the same settings-menu row and init key as `drawCurves` above",
        // Purely visual: the worker emits the ticks either way and
        // `computedColors` paints them transparent when this is off, so this
        // can never cost a refetch.
        defaultValue: false,
      },
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export type LinearSyntenyDisplayConfigSchema = ReturnType<
  typeof configSchemaFactory
>

export default configSchemaFactory
