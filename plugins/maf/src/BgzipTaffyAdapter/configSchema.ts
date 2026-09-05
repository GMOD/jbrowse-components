import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { mafAdapterConfigSchemaFields } from '../util/mafAdapterConfigSchemaFields.ts'
import { expandMafShorthand, taiIndexSlot } from '../util/mafShorthand.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BgzipTaffyAdapter
 * #trackType MafTrack
 * #fileFormat maf | TAF (bgzipped Taffy)
 * used to configure BgzipTaffy adapter
 *
 * #example
 * The `uri` shorthand auto-resolves the sibling `.tai` index; `nhUri` names the
 * Newick tree:
 * ```js
 * {
 *   type: 'BgzipTaffyAdapter',
 *   uri: 'https://example.com/aln.taf.gz',
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'BgzipTaffyAdapter',
  {
    /**
     * #slot
     */
    tafGzLocation: {
      type: 'fileLocation',
      description: 'bgzip taffy file',
      defaultValue: {
        uri: '/path/to/my.taf.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    taiLocation: {
      type: 'fileLocation',
      description: 'taffy index',
      defaultValue: {
        uri: '/path/to/my.taf.gz.tai',
        locationType: 'UriLocation',
      },
    },
    ...mafAdapterConfigSchemaFields({
      summaryAdapter:
        "optional swappable sub-adapter (a BedTabixAdapter over a maf2bed --summary BED, or a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it. The zoom-out tier on the same terms as `BgzipMafAdapter`'s: the `.tai` makes a read cost the span on screen rather than the blocks it lands in, but cost is span × depth and a deep alignment runs out of the second factor. Measured against HPRC's published v2.0 TAF index, 464 haplotypes cost about **2 compressed bytes per bp**, flat from 100 kb up — a ninth of the same alignment's MAF, and still 354 MB for chr6 whole. TAF moves the ceiling out by about 10x; it does not remove it",
    }),
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap =>
      expandMafShorthand(snap, 'tafGzLocation', taiIndexSlot),
  },
)

export type BgzipTaffyAdapterConfig = Instance<typeof configSchema>

export default configSchema
