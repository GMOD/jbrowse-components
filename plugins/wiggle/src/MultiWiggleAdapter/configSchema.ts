import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MultiWiggleAdapter
 * #trackType MultiQuantitativeTrack
 * combines multiple BigWig files into a single multi-row quantitative track
 *
 * #example
 * ```js
 * {
 *   type: 'MultiWiggleAdapter',
 *   bigWigs: [
 *     'https://example.com/sample1.bw',
 *     'https://example.com/sample2.bw',
 *   ],
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
        'array of bigwig filenames, alternative to the subadapters slot',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default MultiWiggleAdapter
