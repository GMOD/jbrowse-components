import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedGCContentConfigSchema from './sharedConfigSchema.ts'

// Its own file, not a shared `makeConfigSchema(name)` helper, because the doc
// generator keys a `#config` block to its file and refuses a second one — see
// the comment in ./index.ts for what was missing while both schemas came from
// one un-annotated helper.
/**
 * #config LinearGCContentDisplay
 * #category display
 *
 * GC content computed from a `ReferenceSequenceTrack`'s own sequence adapter, so
 * there is no second adapter to configure. Use a `GCContentTrack` with
 * [](/docs/config/lineargccontenttrackdisplay) instead when GC should be its own
 * track rather than a display on the sequence.
 *
 * Every slot comes from the shared base below; this display adds none of its
 * own.
 *
 * #example
 * Added to the assembly's `sequence` track, which is where a
 * `ReferenceSequenceTrack` is authored. `gcMode` is `content` for GC percentage
 * or `skew` for (G-C)/(G+C):
 * ```js
 * sequence: {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/genome.fa',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearGCContentDisplay',
 *       displayId: 'refseq-LinearGCContentDisplay',
 *       windowSize: 100,
 *       windowDelta: 100,
 *       gcMode: 'content',
 *     },
 *   ],
 * }
 * ```
 */
export default function linearGCContentDisplayConfigSchema() {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedGCContentConfigSchema(),
      explicitlyTyped: true,
    },
  )
}
