import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'genbankLocation')
}

/**
 * #config GenbankSequenceAdapter
 * #category adapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat sequence | GenBank (.gb, .gbk, .gbff) | Read entirely into memory; for small genomes
 * Reads the `ORIGIN` sequence of each record of a GenBank flat file, named as
 * `GenbankAdapter` names them, so the same file serves as an assembly and as
 * its feature track. A record whose `LOCUS` line says `circular` gives a
 * circular sequence.
 *
 * #example
 * ```js
 * {
 *   type: 'GenbankSequenceAdapter',
 *   uri: 'https://example.com/plasmid.gbk',
 * }
 * ```
 */
const GenbankSequenceAdapter = ConfigurationSchema(
  'GenbankSequenceAdapter',
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
     *   "type": "GenbankSequenceAdapter",
     *   "uri": "yourfile.gbk",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type GenbankSequenceAdapterConfig = Instance<
  typeof GenbankSequenceAdapter
>

export default GenbankSequenceAdapter
