import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'hicLocation')
}

/**
 * #config HicAdapter
 * #category adapter
 * #trackType HicTrack
 * #fileFormat hic | .hic contact matrix
 * Reads Hi-C contact matrices from a `.hic` file.
 *
 * #example
 * ```js
 * {
 *   type: 'HicAdapter',
 *   uri: 'https://example.com/map.hic',
 * }
 * ```
 */
const HicAdapter = ConfigurationSchema(
  'HicAdapter',
  {
    /**
     * #slot
     * location of the `.hic` contact matrix (Juicer / Juicebox format). The
     * file holds every resolution and an index, so there is nothing else to
     * configure — the display picks a bin size from the current zoom.
     */
    hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * a second `HicAdapter`, the control condition the display's
     * `observed/control` field divides by: both are scaled to one library
     * depth, so two libraries sequenced to different depths compare. The two
     * must be on one assembly; chromosome names may differ by a `chr`
     * prefix. Leave it unset for a single map.
     */
    controlAdapter: {
      type: 'maybeFrozen',
      holds: 'adapter',
      description: 'sub-adapter config for the control .hic',
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
    retired: { resolutionMultiplier: () => ({}) },

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "HicAdapter",
     *   "uri": "file.hic",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default HicAdapter
