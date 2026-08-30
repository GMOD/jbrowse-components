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
        type: 'maybeBoolean',
        description:
          'Draw each ribbon as a bezier curve rather than a straight chord. Unset (the default) follows the session-wide default for this display type, falling back to straight chords; an explicit true/false customizes the track. The view-wide `drawCurves` on LinearSyntenyView overrides every level of that view when it is set',
        // Promotable via the `maybeBoolean` sentinel: `undefined` is the inherit
        // state and `promotedBase` what it resolves to when nothing is promoted,
        // so a plain boolean could not promote `false` back over an on default.
        // Read through the display's resolved `effectiveDrawCurves` getter,
        // never raw. The pin is on the VIEW's settings menu (`Curved lines`) —
        // this display curates no track menu of its own.
        promotedBase: false,
      },
      /**
       * #slot
       */
      drawLocationMarkers: {
        type: 'maybeBoolean',
        description:
          "Continue the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track",
        // Same sentinel and the same pin as `drawCurves` above. Purely visual:
        // the worker emits the ticks either way and `computedColors` paints them
        // transparent when this is off, so neither tier can cost a refetch.
        promotedBase: false,
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
