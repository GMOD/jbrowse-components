import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'chromSizesLocation')
}

/**
 * #config ChromSizesAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat sequence | chrom.sizes | Names and lengths only, no sequence
 * Reads the chromosome names and lengths in a UCSC-style `.chrom.sizes` file
 * (tab-separated `name<TAB>length`), for an assembly with no sequence. Use it
 * for karyotype, whole-genome or synteny views that need no base-level
 * sequence.
 *
 * #example
 * ```js
 * {
 *   type: 'ChromSizesAdapter',
 *   uri: 'https://example.com/species.chrom.sizes',
 * }
 * ```
 */
const ChromSizesAdapter = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    /**
     * #slot
     * location of the `.chrom.sizes` file — one `name<TAB>length` line per
     * reference sequence. There is no sequence behind it, so base-level views
     * of this assembly are empty.
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "ChromSizesAdapter",
     *   "uri": "yourfile.chrom.sizes"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default ChromSizesAdapter
