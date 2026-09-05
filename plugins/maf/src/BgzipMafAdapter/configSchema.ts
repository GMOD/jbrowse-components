import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { mafAdapterConfigSchemaFields } from '../util/mafAdapterConfigSchemaFields.ts'
import { expandMafShorthand, taiIndexSlot } from '../util/mafShorthand.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BgzipMafAdapter
 * #trackType MafTrack
 * #fileFormat maf | Indexed MAF (bgzip + .tai) | A published whole-genome multiple alignment, read by locus
 * A bgzip-compressed MAF with a Taffy `.tai` index — the form whole-genome
 * multiple alignments are actually distributed in. HPRC release 2 publishes
 * `hprc-v2.1-mc-grch38.full.maf.gz` (53 GB, 464 haplotypes) with a sibling
 * `.tai`, and Cactus/taffy write the pair for any HAL export. The index gives
 * random access, so a locus is a small ranged read rather than a download: a
 * 10 kb query against HPRC's own index resolves to about 924 KB.
 *
 * Use `BgzipTaffyAdapter` for TAF (taffy's own, more compact format),
 * `MafTabixAdapter` for a `maf2bed` BED, and `BigMafAdapter` for bigMaf.
 *
 * #example
 * The `uri` shorthand auto-resolves the sibling `.tai` index; `nhUri` names the
 * Newick tree:
 * ```js
 * {
 *   type: 'BgzipMafAdapter',
 *   uri: 'https://example.com/aln.maf.gz',
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'BgzipMafAdapter',
  {
    /**
     * #slot
     */
    mafGzLocation: {
      type: 'fileLocation',
      description: 'bgzip-compressed MAF file',
      defaultValue: {
        uri: '/path/to/my.maf.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * The Taffy index. The same `.tai` format `BgzipTaffyAdapter` reads — it
     * describes bgzf virtual offsets against reference coordinates and does not
     * care which text format sits inside — so `taffy index` produces it for a
     * MAF as readily as for a TAF.
     */
    taiLocation: {
      type: 'fileLocation',
      description: 'taffy index',
      defaultValue: {
        uri: '/path/to/my.maf.gz.tai',
        locationType: 'UriLocation',
      },
    },
    ...mafAdapterConfigSchemaFields({
      summaryAdapter:
        "optional swappable sub-adapter (a BedTabixAdapter over a maf2bed --summary BED, or a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it. The `.tai` makes a read cost the span on screen rather than the blocks it lands in, which is why this slot was left off at first — but span is only half of it. Cost is span × depth, and measured against HPRC's own v2.1 index the constant is about **19 compressed bytes per bp** at 464 haplotypes, flat from 100 kb up: 1 Mb is a 19 MB read and chr1 whole is 4.4 GB. So a deep alignment still runs out, just linearly instead of by block",
    }),
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap =>
      expandMafShorthand(snap, 'mafGzLocation', taiIndexSlot),
  },
)

export type BgzipMafAdapterConfig = Instance<typeof configSchema>

export default configSchema
