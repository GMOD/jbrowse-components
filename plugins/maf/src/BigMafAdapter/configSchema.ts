import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { mafAdapterConfigSchemaFields } from '../util/mafAdapterConfigSchemaFields.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BigMafAdapter
 * #trackType MafTrack
 * #fileFormat maf | BigMaf
 * used to configure BigMaf adapter
 *
 * #example
 * `samples` names the rows in the order they are drawn, and has to match the
 * species keys in the file — a bigMaf carries the alignment but not a display
 * order, so an omitted or misspelled name shows as a missing row rather than an
 * error:
 * ```js
 * {
 *   type: 'BigMafAdapter',
 *   bigBedLocation: { uri: 'https://example.com/multiz.bb' },
 *   samples: ['hg38', 'panTro6', 'rheMac10', 'mm39'],
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'BigMafAdapter',
  {
    /**
     * #slot
     * location of the bigMaf file — a BigBed whose extra field holds the MAF
     * alignment block, as built by UCSC's `mafToBigMaf` followed by
     * `bedToBigBed -type=bed3+1 -as=bigMaf.as -tab`.
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bb',
        locationType: 'UriLocation',
      },
    },
    ...mafAdapterConfigSchemaFields({
      summaryAdapter:
        'optional swappable sub-adapter (typically a BigBedAdapter over UCSC bigMafSummary.bb, which is published alongside the bigMaf) used for cheap zoom-out rendering; null disables it',
    }),
  },
  { explicitlyTyped: true },
)

export type BigMafAdapterConfig = Instance<typeof configSchema>

export default configSchema
