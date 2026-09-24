import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { samplesTsvAdapterConfigSchemaFields } from '@jbrowse/core/util/samplesTsv'

/**
 * #config MultiWiggleAdapter
 * #trackType MultiQuantitativeTrack
 * #fileFormat quantitative | Multiple BigWigs
 * combines multiple BigWig files into a single multi-row quantitative track
 *
 * #example
 * The `bigWigs` shorthand: a plain array of BigWig URLs, one subtrack each
 * (the subtrack name is derived from the filename):
 * ```js
 * {
 *   type: 'MultiWiggleAdapter',
 *   bigWigs: [
 *     'https://example.com/sample1.bw',
 *     'https://example.com/sample2.bw',
 *   ],
 * }
 * ```
 *
 * #example
 * Preloading per-subtrack metadata: use `subadapters` instead of `bigWigs` to
 * attach a `name`, a `color`, and a `group` to each subtrack. The extra keys
 * ride along as source metadata — `group` drives the sidebar clustering tree
 * and `color` sets the subtrack's line/fill on load:
 * ```js
 * {
 *   type: 'MultiWiggleAdapter',
 *   subadapters: [
 *     {
 *       type: 'BigWigAdapter',
 *       name: 'Alpha',
 *       group: 'Islet',
 *       color: '#e6194b',
 *       bigWigLocation: { uri: 'https://example.com/alpha.bw' },
 *     },
 *     {
 *       type: 'BigWigAdapter',
 *       name: 'Beta',
 *       group: 'Islet',
 *       color: '#f58231',
 *       bigWigLocation: { uri: 'https://example.com/beta.bw' },
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Per-subtrack metadata from a table: the first column of `samplesTsvLocation`
 * names each subtrack as the adapter does (for `bigWigs`, the filename without
 * its extension), and the other columns ride along as source metadata. The
 * track shows only the subtracks the table lists:
 * ```js
 * {
 *   type: 'MultiWiggleAdapter',
 *   bigWigs: [
 *     'https://example.com/sample1.bw',
 *     'https://example.com/sample2.bw',
 *   ],
 *   samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
 * }
 * ```
 */

const MultiWiggleAdapter = ConfigurationSchema(
  'MultiWiggleAdapter',
  {
    /**
     * #slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    },
    /**
     * #slot
     */
    bigWigs: {
      type: 'frozen',
      description:
        'array of BigWig URLs/paths, alternative to the subadapters slot',
      defaultValue: [],
    },
    /**
     * #slot
     */
    baseUri: {
      type: 'string',
      defaultValue: '',
      advanced: true,
      description:
        'what relative bigWigs URLs resolve against, stamped from the location the config was loaded from',
    },
    ...samplesTsvAdapterConfigSchemaFields,
  },
  { explicitlyTyped: true },
)

export default MultiWiggleAdapter
