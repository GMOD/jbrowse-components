import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'genbankLocation')
}

/**
 * #config GenbankAdapter
 * #category adapter
 * #trackType FeatureTrack
 * #fileFormat feature | GenBank (.gb, .gbk, .gbff) | Loaded entirely into memory; for small genomes
 * Reads the features of a GenBank flat file, one reference sequence per
 * `LOCUS` record, named by its `VERSION` accession or else its `LOCUS` name.
 * `GenbankSequenceAdapter` reads the same file's sequence, so one file can be
 * a whole assembly.
 *
 * #example
 * ```js
 * {
 *   type: 'GenbankAdapter',
 *   uri: 'https://example.com/plasmid.gbk',
 * }
 * ```
 */
const GenbankAdapter = ConfigurationSchema(
  'GenbankAdapter',
  {
    /**
     * #slot
     * location of the GenBank file. May be gzipped; it is decompressed and
     * parsed in full on first use, so the file has to fit in memory.
     */
    genbankLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gbk',
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
     *
     * ```json
     * {
     *   "type": "GenbankAdapter",
     *   "uri": "yourfile.gbk",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type GenbankAdapterConfig = Instance<typeof GenbankAdapter>

export default GenbankAdapter
