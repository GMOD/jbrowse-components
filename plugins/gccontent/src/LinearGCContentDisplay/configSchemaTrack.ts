import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedGCContentConfigSchema from './sharedConfigSchema.ts'

// Its own file, not a shared `makeConfigSchema(name)` helper, because the doc
// generator keys a `#config` block to its file and refuses a second one — see
// the comment in ./index.ts for what was missing while both schemas came from
// one un-annotated helper.
/**
 * #config LinearGCContentTrackDisplay
 * #category display
 *
 * GC content as its own track: the display of a `GCContentTrack`, whose
 * `GCContentAdapter` wraps a sequence adapter. Use
 * [](/docs/config/lineargccontentdisplay) instead to hang GC off an existing
 * `ReferenceSequenceTrack` without configuring a second adapter.
 *
 * Every slot comes from the shared base below; this display adds none of its
 * own.
 *
 * #example
 * GC-skew mode with a small, overlapping sliding window (a `windowDelta` under
 * `windowSize` overlaps the windows, which smooths the signal):
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC content',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'GCContentAdapter' },
 *   displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
 * }
 * ```
 */
export default function linearGCContentTrackDisplayConfigSchema() {
  return ConfigurationSchema(
    'LinearGCContentTrackDisplay',
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
